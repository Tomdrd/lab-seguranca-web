const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

const base = 'http://127.0.0.1:3000';
let server;
let serverOutput = '';

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error('Servidor terminou antes de iniciar: ' + serverOutput);
    try {
      const response = await fetch(base);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Servidor não iniciou em 15s: ' + serverOutput);
}

after(() => {
  if (server && server.exitCode === null) server.kill('SIGTERM');
});

test('controles básicos de segurança web', async (t) => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
  server.stderr.on('data', chunk => { serverOutput += chunk.toString(); });
  await waitForServer();

  await t.test('SQL parametrizado rejeita payload de injeção', async () => {
    const response = await fetch(base + '/seguro/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: "admin@empresa.com' --", senha: 'qualquer' }),
    });
    assert.equal(response.status, 401);
  });

  await t.test('API de comentários valida entrada', async () => {
    const response = await fetch(base + '/api/comentarios', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ texto: '' }),
    });
    assert.equal(response.status, 400);
  });

  await t.test('CSRF exige token válido', async () => {
    const login = await fetch(base + '/csrf/login', { method: 'POST' });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const page = await fetch(base + '/csrf/conta-segura.html', { headers: { cookie } });
    const html = await page.text();
    const token = html.match(/data-token="([a-f0-9]+)"/);
    assert.ok(token, 'token CSRF deve ser entregue à página da sessão');

    const bad = await fetch(base + '/seguro/trocar-email', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ novoEmail: 'novo@example.com', csrfToken: 'token-incorreto' }),
    });
    assert.equal(bad.status, 403);

    const good = await fetch(base + '/seguro/trocar-email', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ novoEmail: 'novo@example.com', csrfToken: token[1] }),
    });
    assert.equal(good.status, 200);
  });

  await t.test('JWT autentica e autorização diferencia admin de usuário', async () => {
    const noToken = await fetch(base + '/api/perfil');
    assert.equal(noToken.status, 401);

    const login = await fetch(base + '/api/jwt/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'tom@empresa.com', senha: '123456' }),
    });
    assert.equal(login.status, 200);
    const { token } = await login.json();

    const profile = await fetch(base + '/api/perfil', { headers: { authorization: 'Bearer ' + token } });
    assert.equal(profile.status, 200);

    const admin = await fetch(base + '/api/admin', { headers: { authorization: 'Bearer ' + token } });
    assert.equal(admin.status, 403);
  });

  await t.test('rate limit responde 429 após três tentativas', async () => {
    let last;
    for (let i = 0; i < 4; i++) {
      last = await fetch(base + '/seguro-forca-bruta/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'teste@example.com', senha: 'errada-' + i }),
      });
    }
    assert.equal(last.status, 429);
  });
});
