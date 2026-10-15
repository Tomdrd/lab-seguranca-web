/* Alternador de tema (escuro/claro) — compartilhado por todas as páginas */
const html = document.documentElement;

function applyTheme(theme) {
  html.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);

  const icon  = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');
  if (icon && label) {
    icon.setAttribute('data-lucide', theme === 'dark' ? 'moon' : 'sun');
    label.textContent = theme === 'dark' ? 'Claro' : 'Escuro';
  }
  if (window.lucide) lucide.createIcons();
}

function toggleTheme() {
  applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}

/* Restaurar preferência salva ou preferência do SO */
(function () {
  const saved = localStorage.getItem('theme');
  if (saved) applyTheme(saved);
  else if (window.matchMedia('(prefers-color-scheme: light)').matches) applyTheme('light');
  else applyTheme('dark');
})();
