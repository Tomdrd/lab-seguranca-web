/* Deck do laboratório: navegação, animações e widgets ligados às rotas reais do servidor. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const post = (url, body, headers = {}) => fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });

  /* ───────────── Navegação ───────────── */
  const slides = $$('.slide');
  let cur = -1;
  let token = 0; // invalida animações de um slide quando saímos dele

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function go(n, back = false) {
    n = Math.max(0, Math.min(slides.length - 1, n));
    if (n === cur) return;
    cur = n; token++;
    slides.forEach((s, i) => {
      s.classList.toggle('active', i === n);
      s.classList.toggle('past', i < n);
    });
    const frags = $$('.frag', slides[n]);
    frags.forEach((f) => f.classList.toggle('shown', back)); // voltando: slide completo
    syncTimeline();
    $('#counter').textContent = `${n + 1} / ${slides.length}`;
    $('#bar').style.width = `${((n + 1) / slides.length) * 100}%`;
    history.replaceState(null, '', `#${n + 1}`);
    const hook = hooks[slides[n].dataset.enter];
    if (hook) hook(slides[n], token);
    if (window.lucide) lucide.createIcons();
  }

  function next() {
    const f = $$('.frag:not(.shown)', slides[cur])[0];
    if (f) { f.classList.add('shown'); syncTimeline(); return; }
    go(cur + 1);
  }
  function prev() {
    const shown = $$('.frag.shown', slides[cur]);
    if (shown.length) { shown[shown.length - 1].classList.remove('shown'); syncTimeline(); return; }
    go(cur - 1, true);
  }
  function syncTimeline() { // barra de progresso do pentest acompanha as etapas reveladas
    const tl = $('#tlFill'); if (!tl) return;
    const all = $$('.stepn'); const on = $$('.stepn.shown').length;
    tl.style.width = `${all.length ? (on / all.length) * 100 : 0}%`;
  }

  /* ───────────── Ganchos de slide ───────────── */
  const hooks = {
    async sqliTeoria(slide, t) {
      const el = $('#tq');
      const payload = "admin@empresa.com' --";
      renderQuery(el, '', '...');
      if (reduce) { renderQuery(el, payload, '...'); return; }
      await sleep(900);
      for (let i = 1; i <= payload.length; i++) {
        if (t !== token) return;
        renderQuery(el, payload.slice(0, i), '...', true);
        await sleep(95);
      }
      renderQuery(el, payload, '...');
    },
    lazyFrames(slide) { // carrega os quadros só quando o slide aparece
      $$('iframe[data-src]', slide).forEach((f) => { if (!f.src) f.src = f.dataset.src; });
    },
  };

  /* ───────────── SQL Injection ───────────── */
  // Monta a consulta do servidor vulnerável e risca o que o "--" transforma em comentário.
  function renderQuery(el, email, senha, caret = false) {
    const seg = [["SELECT * FROM users WHERE email = '", false], [email, true], ["' AND senha = '", false], [senha, true], ["'", false]];
    const chars = seg.flatMap(([txt, inj]) => [...txt].map((ch) => ({ ch, inj })));
    const joined = chars.map((c) => c.ch).join('');
    const cut = joined.indexOf('--');
    let html = '', run = '', key = '';
    const flush = () => { if (run) html += `<span class="${key}">${esc(run)}</span>`; run = ''; };
    chars.forEach((c, i) => {
      const k = `${c.inj ? 'inj' : ''} ${cut >= 0 && i >= cut ? 'cmt' : ''}`.trim();
      if (k !== key) { flush(); key = k; }
      run += c.ch;
    });
    flush();
    el.innerHTML = html;
    el.classList.toggle('caret', caret);
  }

  const sqlE = $('#sqlEmail'), sqlS = $('#sqlSenha');
  const updateQuery = () => renderQuery($('#sqlQuery'), sqlE.value, sqlS.value);
  sqlE.addEventListener('input', updateQuery);
  sqlS.addEventListener('input', updateQuery);
  $$('.chip[data-email]').forEach((c) => c.addEventListener('click', () => {
    sqlE.value = c.dataset.email;
    if (c.dataset.senha !== undefined) sqlS.value = c.dataset.senha;
    updateQuery();
  }));

  function showOut(el, ok, html) {
    el.className = 'out'; void el.offsetWidth; // reinicia a animação
    el.className = `out ${ok ? 'ok' : 'fail'}`;
    el.innerHTML = html;
  }
  async function sqlSend(rota, rotulo, vulneravel) {
    try {
      const r = await post(rota, { email: sqlE.value, senha: sqlS.value });
      const d = await r.json();
      // vulnerável + login aceito = o ATAQUE funcionou (vermelho); segura + recusado = ataque bloqueado (verde)
      const ataqueOk = vulneravel && r.ok;
      const bloqueado = !vulneravel && !r.ok;
      const selo = ataqueOk ? '🚨 Ataque funcionou' : bloqueado ? '🛡 Ataque bloqueado' : '';
      showOut($('#sqlOut'), bloqueado || (!vulneravel && r.ok), `<b>${rotulo}</b> · HTTP ${r.status}${selo ? ` · ${selo}` : ''}<br>${esc(d.mensagem)}`);
    } catch { showOut($('#sqlOut'), false, 'Servidor indisponível'); }
  }
  $('#sqlVul').addEventListener('click', () => sqlSend('/vulneravel/login', '⚠ Vulnerável', true));
  $('#sqlSeg').addEventListener('click', () => sqlSend('/seguro/login', '✓ Segura', false));
  updateQuery();

  /* ───────────── XSS: copiar payload ───────────── */
  $('#copyXss').addEventListener('click', async () => {
    const txt = $('#xssPayload').textContent;
    try { await navigator.clipboard.writeText(txt); toast('Payload copiado'); }
    catch { toast('Selecione e copie manualmente (Ctrl+C)'); }
  });

  /* ───────────── Força bruta ───────────── */
  const senhas = ['123123', 'qwerty', 'senha123', '123456', '000000'];
  const running = {};
  async function atacar(chave, rota, lista) {
    if (running[chave]) return;
    running[chave] = true;
    lista.innerHTML = '';
    const add = (cls, txt) => { const li = document.createElement('li'); li.className = cls; li.textContent = txt; lista.appendChild(li); return li; };
    try {
      for (const senha of senhas) {
        const li = add('', `tentando "${senha}"…`);
        const r = await post(rota, { email: 'tom@empresa.com', senha });
        if (r.status === 429) { li.className = 'block'; li.textContent = `"${senha}" → BLOQUEADO (429). A senha correta nem foi testada.`; break; }
        if (r.status === 200) { li.className = 'ok'; li.textContent = `"${senha}" → SUCESSO! Senha descoberta.`; break; }
        li.className = 'fail'; li.textContent = `"${senha}" → falhou`;
        await sleep(reduce ? 50 : 500);
      }
    } catch { add('block', 'Servidor indisponível'); }
    running[chave] = false;
  }
  $('#bfVul').addEventListener('click', () => atacar('v', '/vulneravel-forca-bruta/login', $('#bfVulList')));
  $('#bfSeg').addEventListener('click', () => atacar('s', '/seguro-forca-bruta/login', $('#bfSegList')));

  /* ───────────── JWT ───────────── */
  let jwt = null, expTimer = null;
  const b64uDecode = (s) => {
    const b = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0))));
  };
  const b64uEncode = (obj) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  function renderToken() {
    clearInterval(expTimer);
    if (!jwt) {
      $('#jwtToken').textContent = '(faça login para receber o token)';
      $('#jwtH').textContent = '—'; $('#jwtP').textContent = '—'; $('#jwtExp').textContent = '';
      return;
    }
    const [h, p, s] = jwt.split('.');
    $('#jwtToken').innerHTML = `<span class="p1">${esc(h)}</span>.<span class="p2">${esc(p)}</span>.<span class="p3">${esc(s)}</span>`;
    const payload = b64uDecode(p);
    $('#jwtH').textContent = JSON.stringify(b64uDecode(h), null, 1);
    $('#jwtP').textContent = JSON.stringify(payload, null, 1);
    const tick = () => {
      const left = Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
      $('#jwtExp').textContent = left ? `· expira em ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '· EXPIRADO';
    };
    tick(); expTimer = setInterval(tick, 1000);
  }
  async function perfil(rotulo, headers) {
    try {
      const r = await fetch('/api/perfil', { headers });
      const d = await r.json();
      showOut($('#jwtOut'), r.ok, `<b>${rotulo}</b> · HTTP ${r.status}<br>${esc(JSON.stringify(d))}`);
    } catch { showOut($('#jwtOut'), false, 'Servidor indisponível'); }
  }
  $('#jwtLogin').addEventListener('click', async () => {
    try {
      const r = await post('/api/jwt/login', { email: 'tom@empresa.com', senha: '123456' });
      const d = await r.json();
      if (d.token) { jwt = d.token; renderToken(); showOut($('#jwtOut'), true, 'Login ok: token recebido (veja à direita).'); }
      else showOut($('#jwtOut'), false, esc(d.mensagem || 'Falha no login'));
    } catch { showOut($('#jwtOut'), false, 'Servidor indisponível'); }
  });
  $('#jwtSem').addEventListener('click', () => perfil('Sem token', {}));
  $('#jwtCom').addEventListener('click', () => {
    if (!jwt) return showOut($('#jwtOut'), false, 'Faça login primeiro para obter um token.');
    perfil('Com token', { Authorization: `Bearer ${jwt}` });
  });
  $('#jwtFake').addEventListener('click', () => {
    if (!jwt) return showOut($('#jwtOut'), false, 'Faça login primeiro para obter um token.');
    const [h, p, s] = jwt.split('.');
    const forged = b64uEncode({ ...b64uDecode(p), perfil: 'admin' });
    perfil('Token adulterado (perfil: admin)', { Authorization: `Bearer ${h}.${forged}.${s}` });
  });

  /* ───────────── Reset, tela cheia, tema e atalhos ───────────── */
  async function resetDemos() {
    try {
      const r = await fetch('/api/reset', { method: 'POST' });
      toast(r.ok ? 'Demos reiniciadas' : 'Não foi possível reiniciar');
    } catch { toast('Servidor indisponível'); }
    $$('iframe').forEach((f) => { if (f.src) f.src = f.src; });
    ['#bfVulList', '#bfSegList'].forEach((s) => { $(s).innerHTML = ''; });
    jwt = null; renderToken();
    $('#jwtOut').className = 'out'; $('#jwtOut').textContent = 'Aguardando…';
    $('#sqlOut').className = 'out'; $('#sqlOut').textContent = 'Aguardando envio…';
  }
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());

  $('#btnNext').addEventListener('click', next);
  $('#btnPrev').addEventListener('click', prev);
  $('#btnReset').addEventListener('click', resetDemos);
  $('#btnFull').addEventListener('click', fullscreen);

  function onKey(e) {
    if (e.target.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (['ArrowRight', 'PageDown', ' '].includes(k)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'PageUp'].includes(k)) { e.preventDefault(); prev(); }
    else if (k === 'Home') go(0);
    else if (k === 'End') go(slides.length - 1, true);
    else if (k.toLowerCase() === 'f') fullscreen();
    else if (k.toLowerCase() === 't') toggleTheme();
    else if (k.toLowerCase() === 'r') resetDemos();
  }
  document.addEventListener('keydown', onKey);

  // Os quadros das demos são da mesma origem: repassa as teclas deles ao deck,
  // para as setas continuarem funcionando depois de clicar dentro de um quadro.
  function ligarQuadro(f) {
    const anexar = () => { try { f.contentDocument.addEventListener('keydown', onKey); } catch { /* outra origem */ } };
    f.addEventListener('load', anexar);
    anexar();
  }
  $$('iframe').forEach(ligarQuadro);

  // Depois de clicar com o mouse, tira o foco do botão: a barra de espaço avança o slide
  // em vez de repetir o clique (ex.: "Atacar" disparando de novo).
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && e.detail > 0) b.blur();
  });
  let x0 = null;
  document.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 60) (dx < 0 ? next : prev)();
  });

  window.addEventListener('hashchange', () => { // botão voltar/avançar do navegador e links #N
    const n = parseInt(location.hash.slice(1), 10);
    if (Number.isFinite(n) && n - 1 !== cur) go(n - 1, n - 1 < cur);
  });

  const inicial = parseInt(location.hash.slice(1), 10);
  go(Number.isFinite(inicial) ? inicial - 1 : 0, true);
  if (!Number.isFinite(inicial)) $$('.frag', slides[0]).forEach((f) => f.classList.remove('shown'));
})();
