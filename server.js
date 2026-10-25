const express = require('express');
const Database = require('better-sqlite3');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { paginaCSRF, escaparHtml } = require('./lib/render-csrf');

const app = express();
app.disable('x-powered-by'); // não anunciar a tecnologia do servidor
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use((req, res, next) => { if (req.body === undefined) req.body = {}; next(); }); // Express 5: sem corpo => undefined

// A chave fixa existe somente para a demo local. Em produção, falhe sem um segredo forte configurado.
if (process.env.NODE_ENV === 'production' &&
    (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('Em produção, JWT_SECRET deve ser configurado e ter pelo menos 32 caracteres.');
}
const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta-apenas-para-demo-didatica';

const textoValido = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const emailValido = (v) => textoValido(v, 120) && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(v);
const mascararEmail = (email) => {
  if (typeof email !== 'string' || !email.includes('@')) return '[email inválido/ausente]';
  const [usuario, dominio] = email.split('@');
  return `${usuario.slice(0, 1)}***@${dominio}`;
};

// ---------- Banco de dados (SQL Injection) ----------
// Senhas em texto puro SÓ porque é demo; em produção: hash lento com salt (bcrypt/Argon2)
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
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
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

app.use(express.static(path.join(__dirname, 'public'))); // caminho absoluto: funciona de qualquer pasta

// ================= SQL INJECTION =================
app.post('/vulneravel/login', (req, res) => {
  const { email, senha } = req.body;
  const query = `SELECT * FROM users WHERE email = '${email}' AND senha = '${senha}'`;
  console.log('[VULNERÁVEL] Consulta concatenada executada; entrada omitida dos logs.');
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
  if (!textoValido(email, 120) || !textoValido(senha, 120)) return res.status(400).json({ ok: false, mensagem: 'Dados inválidos' });
  const query = 'SELECT * FROM users WHERE email = ? AND senha = ?';
  console.log('[SEGURO] Consulta parametrizada executada; credenciais omitidas dos logs.');
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
  if (!textoValido(texto, 500)) return res.status(400).json({ ok: false, mensagem: 'Comentário inválido (texto de 1 a 500 caracteres)' });
  comentarios.push(texto);
  if (comentarios.length > 100) comentarios.shift();
  console.log(`[COMENTÁRIO] Novo comentário salvo (${texto.length} caracteres); conteúdo omitido dos logs.`);
  res.json({ ok: true });
});

// ================= CSRF =================
app.post('/csrf/login', (req, res) => {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const csrfToken = crypto.randomBytes(32).toString('hex');
  sessoesCSRF.set(sessionId, { email: 'tom@empresa.com', csrfToken });
  // Cookie permissivo somente no modo local para tornar o ataque CSRF observável.
  // Em produção, use HTTPS e configure Secure/HttpOnly/SameSite de acordo com o fluxo.
  res.cookie('sessaoCSRF', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : false,
    path: '/',
  });
  console.log('[CSRF] Sessão de demonstração criada; identificador e token omitidos dos logs.');
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
  const recebido = Buffer.from(String(req.body.csrfToken ?? ''));
  const esperado = Buffer.from(sessao.csrfToken);
  const tokenOk = recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado);
  if (!tokenOk) {
    console.log('[CSRF SEGURO] Tentativa bloqueada: token ausente ou inválido (valor omitido).');
    return res.status(403).json({ ok: false, mensagem: 'Bloqueado: token CSRF inválido' });
  }
  if (!emailValido(req.body.novoEmail)) return res.status(400).json({ ok: false, mensagem: 'E-mail inválido' });
  sessao.email = req.body.novoEmail;
  console.log('[CSRF SEGURO] E-mail trocado com sucesso (token válido):', mascararEmail(sessao.email));
  res.json({ ok: true, mensagem: 'E-mail alterado para ' + sessao.email });
});

// ================= FORÇA BRUTA =================
// VULNERÁVEL: sem limite de tentativas
app.post('/vulneravel-forca-bruta/login', (req, res) => {
  const { email, senha } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND senha = ?').get(email, senha);
  console.log(`[FORÇA BRUTA - VULNERÁVEL] Tentativa para ${mascararEmail(email)} -> ${user ? 'SUCESSO' : 'falhou'} (senha omitida).`);
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
    console.log(`[FORÇA BRUTA - SEGURO] Bloqueio por excesso de tentativas para ${mascararEmail(req.body?.email)}.`);
    res.status(options.statusCode).json(options.message);
  }
});

// SEGURO: com limite de tentativas
app.post('/seguro-forca-bruta/login', limitadorLogin, (req, res) => {
  const { email, senha } = req.body;
  if (!textoValido(email, 120) || !textoValido(senha, 120)) return res.status(400).json({ ok: false, mensagem: 'Dados inválidos' });
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND senha = ?').get(email, senha);
  console.log(`[FORÇA BRUTA - SEGURO] Tentativa para ${mascararEmail(email)} -> ${user ? 'SUCESSO' : 'falhou'} (senha omitida).`);
  if (user) return res.json({ ok: true, mensagem: `Login OK: ${user.email}` });
  res.status(401).json({ ok: false, mensagem: 'Credenciais inválidas' });
});

// ================= JWT =================
app.post('/api/jwt/login', (req, res) => {
  const { email, senha } = req.body;
  if (!textoValido(email, 120) || !textoValido(senha, 120)) return res.status(400).json({ ok: false, mensagem: 'Dados inválidos' });
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND senha = ?').get(email, senha);
  if (!user) return res.status(401).json({ ok: false, mensagem: 'Credenciais inválidas' });
  const token = jwt.sign({ email: user.email, perfil: user.perfil }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
  console.log('[JWT] Token emitido para', mascararEmail(user.email));
  res.json({ ok: true, token });
});

function verificarToken(req, res, next) {
  const partes = /^Bearer (\S+)$/.exec(req.headers.authorization || ''); // exige o esquema "Bearer xxxxx"
  const token = partes && partes[1];
  if (!token) {
    console.log('[JWT] Pedido sem token recusado');
    return res.status(401).json({ ok: false, mensagem: 'Token ausente' });
  }
  jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, payload) => { // algoritmo fixo: barra 'alg: none'
    if (err) {
      console.log('[JWT] Token inválido/expirado recusado');
      return res.status(401).json({ ok: false, mensagem: 'Token inválido ou expirado' });
    }
    req.usuario = payload;
    next();
  });
}

app.get('/api/perfil', verificarToken, (req, res) => {
  console.log('[JWT] Acesso autorizado a /api/perfil para', mascararEmail(req.usuario.email));
  res.json({ ok: true, email: req.usuario.email, perfil: req.usuario.perfil });
});

// JWT válido autentica o usuário, mas cada recurso ainda deve aplicar autorização.
app.get('/api/admin', verificarToken, (req, res) => {
  if (req.usuario.perfil !== 'admin') {
    return res.status(403).json({ ok: false, mensagem: 'Acesso negado: perfil insuficiente' });
  }
  res.json({ ok: true, mensagem: 'Acesso administrativo autorizado' });
});

// ================= RESET DAS DEMOS (só localhost) =================
// Útil entre ensaio e apresentação: limpa comentários, sessões e o limite de tentativas.
app.post('/api/reset', (req, res) => {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip)) return res.status(403).json({ ok: false });
  comentarios = [];
  sessoesCSRF.clear();
  limitadorLogin.resetKey(ipKeyGenerator(req.ip));
  console.log('[RESET] Demos reiniciadas');
  res.json({ ok: true });
});

// Tratamento de erros: nunca devolver stack trace nem caminhos do servidor ao cliente
app.use((err, req, res, next) => {
  console.error('[ERRO]', err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ ok: false, mensagem: status === 400 ? 'Requisição inválida' : 'Erro interno' });
});

app.listen(3000, () => console.log('Laboratório rodando em http://localhost:3000'));

// "Site malicioso" da demo de CSRF: outra porta = outra origem, como um site externo de verdade.
// Serve somente o ataque-evil.html (que fica fora de public/ de propósito).
const siteMalicioso = express();
siteMalicioso.get('/', (req, res) => res.sendFile(__dirname + '/ataque-evil.html'));
siteMalicioso.listen(3001, () => console.log('Site malicioso (demo CSRF) em http://localhost:3001'));
