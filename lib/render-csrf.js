const fs = require('fs');
const path = require('path');

function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Página de resultado das rotas CSRF (antes era uma string HTML solta no server.js)
function paginaCSRF(titulo, conteudoHtml) {
  const modelo = fs.readFileSync(path.join(__dirname, '..', 'views', 'csrf', 'resultado.html'), 'utf8');
  return modelo.split('{{TITULO}}').join(escaparHtml(titulo)).split('{{CONTEUDO}}').join(conteudoHtml);
}

module.exports = { paginaCSRF, escaparHtml };
