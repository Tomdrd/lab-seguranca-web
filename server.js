const express = require('express');
const Database = require('better-sqlite3');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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

// VULNERÁVEL: GET muda dado e não checa de onde veio o pedido
app.get('/vulneravel/trocar-email', (req, res) => {
  const sessao = sessoesCSRF.get(req.cookies.sessaoCSRF);
  if (!sessao) return res.status(401).send('Não logado. Volte e faça login na demo de CSRF.');
  const antigo = sessao.email;
  sessao.email = req.query.novoEmail;
  console.log(`[CSRF VULNERÁVEL] E-mail trocado de "${antigo}" para "${sessao.email}" — SEM checar a origem do pedido!`);
  res.send(`<p>E-mail alterado para <strong>${sessao.email}</strong>.</p><p><a href="/csrf/conta-vulneravel.html">Voltar</a></p>`);
});

// SEGURO: só aceita POST + exige o token que só a página legítima conhece
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

app.listen(3000, () => console.log('Laboratório rodando em http://localhost:3000'));
