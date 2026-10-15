async function carregar() {
  const r = await fetch('/api/comentarios');
  const comentarios = await r.json();
  const lista = document.getElementById('lista');
  lista.innerHTML = '';
  comentarios.forEach(c => {
    const div = document.createElement('div');
    div.className = 'comentario';
    div.textContent = c; // SEGURO: textContent nunca interpreta HTML/JS
    lista.appendChild(div);
  });
}

async function enviar() {
  const campo = document.getElementById('texto');
  await fetch('/api/comentarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto: campo.value })
  });
  campo.value = '';
  carregar();
}

document.getElementById('btnEnviar').addEventListener('click', enviar);
carregar();
