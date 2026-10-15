const express = require('express');
const Database = require('better-sqlite3');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// ---------- Banco de dados em memória ----------
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

// ---------- ROTA VULNERÁVEL ----------
app.post('/vulneravel/login', (req, res) => {
  const { email, senha } = req.body;

  // PERIGO: concatenando a entrada do usuário direto na query
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

// ---------- ROTA SEGURA ----------
app.post('/seguro/login', (req, res) => {
  const { email, senha } = req.body;

  // Prepared Statement: os dados vão separados da query
  const query = 'SELECT * FROM users WHERE email = ? AND senha = ?';
  console.log('[SEGURO] Query executada:', query, '| parâmetros:', [email, senha]);

  const user = db.prepare(query).get(email, senha);
  if (user) return res.json({ ok: true, mensagem: `Bem-vindo, ${user.email} (${user.perfil})` });
  res.status(401).json({ ok: false, mensagem: 'Credenciais inválidas' });
});

app.listen(3000, () => console.log('Laboratório rodando em http://localhost:3000'));
