const express = require('express');
const Database = require('better-sqlite3');

const app = express();
app.use(express.json());

// ---------- Rota da página segura (HTML fora de /public, com CSP) ----------
app.get('/seguro-comentarios.html', (req, res) => {
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; object-src 'none'");
  res.sendFile(__dirname + '/views/seguro-comentarios.html');
});

app.use(express.static('public'));

// ---------- Banco de dados em memória (SQL Injection) ----------
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

// ---------- Comentários (XSS) ----------
let comentarios = [];

app.get('/api/comentarios', (req, res) => {
  res.json(comentarios);
});

app.post('/api/comentarios', (req, res) => {
  const { texto } = req.body;
  comentarios.push(texto);
  console.log('[COMENTÁRIO] Novo comentário salvo:', texto);
  res.json({ ok: true });
});

app.listen(3000, () => console.log('Laboratório rodando em http://localhost:3000'));
