const express = require('express');
const Database = require('better-sqlite3');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { paginaCSRF, escaparHtml } = require('./lib/render-csrf');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const JWT_SECRET = 'chave-secreta-apenas-para-demo-didatica'; // em produção: variável de ambiente

// ---------- Banco de dados (SQL Injection) ----------
const db = new Database(':memory:');
db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT,
    senha TEXT,
    perfil TEXT
  );
  INSERT INTO users (email, senha, perfil) VALUES
    ('admin@empresa.com', 'S3nh@Forte!', 'admin'),
    ('tom@empresa.com', '123456', 'usuario');
`);

// ---------- Comentários (XSS) ----------
let comentarios = [];

// ---------- Sessões (CSRF) ----------
const sessoesCSRF = new Map(); // sessionId -> { email, csrfToken }

// ---------- Rotas com header especial (precisam vir antes do static) ----------
app.get('/seguro-comentarios.html', (req, res) => {
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; object-src 'none'");
  res.sendFile(__dirname + '/views/seguro-comentarios.html');
});

app.get('/csrf/conta-segura.html', (req, res) => {
  const sessao = sessoesCSRF.get(req.cookies.sessaoCSRF);
  const token = sessao ? sessao.csrfToken : '';
  let html = fs.readFileSync(__dirname + '/views/csrf/conta-segura.html', 'utf8');
  html = html.replace('{{CSRF_TOKEN}}', token);
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; object-src 'none'");
  res.send(html);
});

app.use(express.static('public'));

// ================= SQL INJECTION =================
app.post('/vulneravel/login', (req, res) => {
  const { email, senha } = req.body;
  const query = `SELECT * FROM users WHERE email = '${email}' AND senha = '${senha}'`;
  console.log('[VULNERÁVEL] Query executada:', query);
  try {
    const user = db.prepare(query).get();
    if (user) return res.json({ ok: true, mensagem: `Bem-vindo, ${user.email} (${user.perfil})` });
    res.status(401).json({ ok: false, mensagem: 'Credenciais inválidas' });
  } catch (e) {
    res.status(500).json({ ok: false, mensagem: 'Erro: ' + e.message });
  }
});

app.post('/seguro/login', (req, res) => {
  const { email, senha } = req.body;
  const query = 'SELECT * FROM users WHERE email = ? AND senha = ?';
  console.log('[SEGURO] Query executada:', query, '| parâmetros:', [email, senha]);
  const user = db.prepare(query).get(email, senha);
  if (user) return res.json({ ok: true, mensagem: `Bem-vindo, ${user.email} (${user.perfil})` });
  res.status(401).json({ ok: false, mensagem: 'Credenciais inválidas' });
});

// ================= XSS =================
app.get('/api/comentarios', (req, res) => {
  res.json(comentarios);
});

app.post('/api/comentarios', (req, res) => {
  const { texto } = req.body;
  comentarios.push(texto);
  console.log('[COMENTÁRIO] Novo comentário salvo:', texto);
  res.json({ ok: true });
});

// ================= CSRF =================
app.post('/csrf/login', (req, res) => {
  const sessionId = crypto.randomBytes(16).toString('hex');
  const csrfToken = crypto.randomBytes(16).toString('hex');
  sessoesCSRF.set(sessionId, { email: 'tom@empresa.com', csrfToken });
  res.cookie('sessaoCSRF', sessionId, { httpOnly: true });
  console.log('[CSRF] Sessão criada para tom@empresa.com | token:', csrfToken);
  res.json({ ok: true });
});

app.get('/api/csrf/conta', (req, res) => {
  const sessao = sessoesCSRF.get(req.cookies.sessaoCSRF);
  res.json({ email: sessao ? sessao.email : null });
});

app.get('/vulneravel/trocar-email', (req, res) => {
  const sessao = sessoesCSRF.get(req.cookies.sessaoCSRF);
  if (!sessao) return res.status(401).send(paginaCSRF('Não logado', '      <p class="alvo">Não há sessão ativa. Volte e faça login na demo de CSRF: <a href="/csrf/login.html">/csrf/login.html</a>.</p>'));
  const antigo = sessao.email;
  sessao.email = req.query.novoEmail;
  console.log(`[CSRF VULNERÁVEL] E-mail trocado de "${antigo}" para "${sessao.email}" — SEM checar a origem do pedido!`);
  res.send(paginaCSRF('E-mail alterado', `      <p class="alvo">O e-mail da conta agora é <strong class="perigo">${escaparHtml(sessao.email)}</strong>.</p>
      <p class="alvo">Ninguém clicou em "Trocar e-mail": o navegador enviou o pedido junto com o cookie de sessão.</p>`));
});

app.post('/seguro/trocar-email', (req, res) => {
  const sessao = sessoesCSRF.get(req.cookies.sessaoCSRF);
  if (!sessao) return res.status(401).json({ ok: false, mensagem: 'Não logado' });
  if (req.body.csrfToken !== sessao.csrfToken) {
    console.log('[CSRF SEGURO] Tentativa BLOQUEADA — token ausente ou inválido. Recebido:', req.body.csrfToken);
    return res.status(403).json({ ok: false, mensagem: 'Bloqueado: token CSRF inválido' });
  }
  sessao.email = req.body.novoEmail;
  console.log('[CSRF SEGURO] E-mail trocado com sucesso (token válido):', sessao.email);
  res.json({ ok: true, mensagem: 'E-mail alterado para ' + sessao.email });
});

// ================= FORÇA BRUTA =================
// VULNERÁVEL: sem limite de tentativas
app.post('/vulneravel-forca-bruta/login', (req, res) => {
  const { email, senha } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND senha = ?').get(email, senha);
  console.log(`[FORÇA BRUTA - VULNERÁVEL] Tentativa: ${email} / ${senha} -> ${user ? 'SUCESSO' : 'falhou'}`);
  if (user) return res.json({ ok: true, mensagem: `Login OK: ${user.email}` });
  res.status(401).json({ ok: false, mensagem: 'Credenciais inválidas' });
});

// Limitador: no máximo 3 tentativas a cada 1 minuto por IP
const limitadorLogin = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, mensagem: 'Muitas tentativas. Tente novamente em instantes.' },
  handler: (req, res, next, options) => {
    console.log(`[FORÇA BRUTA - SEGURO] BLOQUEADO por excesso de tentativas: ${req.body?.email}`);
    res.status(options.statusCode).json(options.message);
  }
});

// SEGURO: com limite de tentativas
app.post('/seguro-forca-bruta/login', limitadorLogin, (req, res) => {
  const { email, senha } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND senha = ?').get(email, senha);
  console.log(`[FORÇA BRUTA - SEGURO] Tentativa: ${email} / ${senha} -> ${user ? 'SUCESSO' : 'falhou'}`);
  if (user) return res.json({ ok: true, mensagem: `Login OK: ${user.email}` });
  res.status(401).json({ ok: false, mensagem: 'Credenciais inválidas' });
});

// ================= JWT =================
app.post('/api/jwt/login', (req, res) => {
  const { email, senha } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND senha = ?').get(email, senha);
  if (!user) return res.status(401).json({ ok: false, mensagem: 'Credenciais inválidas' });
  const token = jwt.sign({ email: user.email, perfil: user.perfil }, JWT_SECRET, { expiresIn: '15m' });
  console.log('[JWT] Token emitido para', user.email);
  res.json({ ok: true, token });
});

function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization; // "Bearer xxxxx"
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    console.log('[JWT] Pedido SEM token recusado');
    return res.status(401).json({ ok: false, mensagem: 'Token ausente' });
  }
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      console.log('[JWT] Token inválido/expirado recusado');
      return res.status(401).json({ ok: false, mensagem: 'Token inválido ou expirado' });
    }
    req.usuario = payload;
    next();
  });
}

app.get('/api/perfil', verificarToken, (req, res) => {
  console.log('[JWT] Acesso autorizado a /api/perfil para', req.usuario.email);
  res.json({ ok: true, email: req.usuario.email, perfil: req.usuario.perfil });
});

app.listen(3000, () => console.log('Laboratório rodando em http://localhost:3000'));

// "Site malicioso" da demo de CSRF: outra porta = outra origem, como um site externo de verdade.
// Serve somente o ataque-evil.html (que fica fora de public/ de propósito).
const siteMalicioso = express();
siteMalicioso.get('/', (req, res) => res.sendFile(__dirname + '/ataque-evil.html'));
siteMalicioso.listen(3001, () => console.log('Site malicioso (demo CSRF) em http://localhost:3001'));
