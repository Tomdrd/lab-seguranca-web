const csrfToken = document.body.dataset.token;

async function carregar() {
  const r = await fetch('/api/csrf/conta');
  const d = await r.json();
  document.getElementById('email').textContent = d.email || '(não logado)';
}

document.getElementById('btnTrocar').addEventListener('click', async () => {
  const novoEmail = document.getElementById('novoEmail').value;
  const r = await fetch('/seguro/trocar-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ novoEmail, csrfToken })
  });
  const d = await r.json();
  document.getElementById('msg').textContent = d.mensagem;
  carregar();
});

carregar();
