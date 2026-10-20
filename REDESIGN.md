# Documentação do Redesign — Laboratório de Segurança Web

> **Contexto:** Esta documentação registra as decisões técnicas, padrões visuais e arquiteturais estabelecidos durante o redesign da interface do projeto (Lab de Segurança Web - Grupo 3 / Anhanguera), permitindo que qualquer desenvolvedor ou assistente de IA continue a padronização das demais páginas.

---

## 1. Visão Geral do Projeto

- **Aplicação:** Laboratório educacional de Segurança e Auditoria de Sistemas (Node.js, Express, better-sqlite3, JWT, rate-limit).
- **Ambiente de Apresentação:** Telão / Projetor em sala de aula (exigência de alta legibilidade a distância).
- **Arquivo Modificado na Sessão:**
  - [`public/index.html`](file:///home/tom/lab-seguranca-web/public/index.html): Portal principal e demonstração prática de **SQL Injection** com links para as outras vulnerabilidades.

---

## 2. Decisões de Design e UX

### 2.1. Escala Proporcional para Telões (`rem` + `vw`)
Para garantir legibilidade tanto em notebooks quanto em projetores/telas grandes de sala de aula:
- O elemento raiz define escala dinâmica:
  ```css
  html {
    font-size: clamp(1rem, 1.5vw, 1.6rem);
  }
  ```
- **Regra:** Todas as medidas de espaçamento (`padding`, `margin`, `gap`), dimensões de cards/botões e tamanhos de fonte utilizam unidades relativas em `rem` ou `em`.

### 2.2. Biblioteca de Ícones
- Emojis foram substituídos pela biblioteca **[Lucide Icons](https://lucide.dev/)** via CDN:
  ```html
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
  ```
- Ícones são renderizados via `<i data-lucide="..."></i>` e inicializados via `lucide.createIcons()`.
- **Importante:** Quando o DOM é manipulado via JavaScript (ex: respostas de login assíncronas), deve-se invocar `lucide.createIcons()` logo após atualizar o `innerHTML`.

### 2.3. Sistema de Tema (Dark / Light Mode)
- Implementado via atributo `data-theme` na tag `<html lang="pt-BR" data-theme="dark">`.
- Botão fixo no canto superior direito (`.theme-toggle`) com transição suave (`transition-duration: .25s`).
- **Persistência e Detecção:**
  - `localStorage.getItem('theme')` armazena a preferência do usuário.
  - Se ausente, detecta `window.matchMedia('(prefers-color-scheme: light)')`.
  - Fallback padrão: `dark`.

---

## 3. Conformidade WCAG 2.1 (AA / AAA) e Paleta de Cores

Todas as cores de texto e interações foram calibradas para atender estritamente aos critérios de contraste (mínimo de 4.5:1 para texto normal e ≥ 7:1 para nível AAA).

### 3.1. Variáveis CSS (`tokens`)

```css
/* ── MODO ESCURO (Padrão) ── */
:root, [data-theme="dark"] {
  --bg:          #0a0e1a;   /* Fundo principal */
  --surface:     #111827;   /* Painéis e cards */
  --surface2:    #1a2235;   /* Inputs e caixas secundárias */
  --border:      #1e2d45;   /* Bordas estruturais */
  --border-hover:#2a4060;
  --accent:      #00d4ff;   /* Ciano de destaque (CR ≈ 10.9:1 - AAA) */
  --accent2:     #a78bfa;   /* Roxo secundário (CR ≈ 6.7:1 - AAA) */
  --green:       #34d399;   /* Sucesso / Seguro (CR ≈ 9.7:1 - AAA) */
  --red:         #f87171;   /* Erro / Vulnerável (CR ≈ 7.0:1 - AAA) */
  --orange:      #fb923c;   /* Alerta / Força Bruta (CR ≈ 8.5:1 - AAA) */
  --yellow:      #fbbf24;   /* Atenção / XSS (CR ≈ 11.5:1 - AAA) */
  --text:        #e2e8f0;   /* Texto principal (CR ≈ 15.1:1 - AAA) */
  --text-strong: #f8fafc;   /* Títulos (CR ≈ 17.9:1 - AAA) */
  --muted:       #94a3b8;   /* Legendas e labels (CR ≈ 7.5:1 - AAA) */
}

/* ── MODO CLARO ── */
[data-theme="light"] {
  --bg:          #f0f4f8;   /* Fundo cinza/azulado claro */
  --surface:     #ffffff;   /* Fundo de cards puro */
  --surface2:    #f1f5f9;   /* Inputs e caixas secundárias */
  --border:      #cbd5e1;
  --border-hover:#94a3b8;
  --accent:      #0369a1;   /* Azul escuro (CR ≈ 5.4:1 - AA+) */
  --accent2:     #6d28d9;   /* Roxo escuro (CR ≈ 6.4:1 - AAA) */
  --green:       #166534;   /* Verde escuro (CR ≈ 6.4:1 - AAA) */
  --red:         #b91c1c;   /* Vermelho escuro (CR ≈ 5.9:1 - AA+) */
  --orange:      #c2410c;   /* Laranja escuro (CR ≈ 4.7:1 - AA+) */
  --yellow:      #92400e;   /* Âmbar escuro (CR ≈ 6.4:1 - AAA) */
  --text:        #1e293b;   /* Texto escuro (CR ≈ 13.2:1 - AAA) */
  --text-strong: #0f172a;   /* Títulos (CR ≈ 15.6:1 - AAA) */
  --muted:       #475569;   /* Legendas (CR ≈ 6.9:1 - AAA) */
}
```

### 3.2. Práticas Críticas de CSS Adotadas
1. **Evitar transparência composta em texto:** Não usar `opacity: 0.7x` em textos secundários dentro de botões coloridos (`.btn-label`). Em vez disso, usar variação de `font-weight: 400` para manter o contraste estritamente acessível.
2. **`color-mix(in srgb, ...)` para fundos e bordas:** Em vez de definir valores hexadecimais ou `rgba()` fixos nos botões e tags, usamos:
   ```css
   background: color-mix(in srgb, var(--green) 14%, transparent);
   border: 1px solid color-mix(in srgb, var(--green) 38%, transparent);
   color: var(--green);
   ```
   Isso permite que qualquer mudança de tema recalcule fundos sem quebrar o contraste do texto.

---

## 4. Estado atual do redesign

Todas as páginas do laboratório usam o mesmo Design System.

**Arquivos compartilhados**
- `public/styles/theme.css`: tokens claro/escuro e componentes base (botões, painel, campos, caixas de resultado, link de voltar).
- `public/styles/comentarios.css`: componentes da demo de XSS.
- `public/styles/demos.css`: componentes das demos de força bruta, JWT e CSRF (caixa de log, rótulos).
- `public/scripts/theme.js`: alternador de tema, ligado por `addEventListener`.
- `public/scripts/lucide.min.js`: Lucide local (offline), sem dependência de CDN.

**Páginas padronizadas:** `index`, XSS (vulnerável e segura), força bruta, JWT e CSRF (login, conta vulnerável e conta segura). O `ataque-evil.html` tem estilo próprio e independente, porque simula um site externo.

**Regra importante para páginas com CSP.** As rotas `/seguro-comentarios.html` e `/csrf/conta-segura.html` enviam `script-src 'self'` e `default-src 'self'`. Nelas não pode haver:
- `<style>` ou `style=""` inline (o CSS deve vir de arquivo em `/styles/`);
- `<script>` inline;
- atributos `onclick=""` (use `addEventListener`).

Na `views/csrf/conta-segura.html`, o placeholder do token deve aparecer uma única vez, porque o servidor faz `replace` apenas da primeira ocorrência.

## 5. Deck de slides e revisão de segurança

- `public/slides.html`, `public/styles/slides.css` e `public/scripts/slides.js`: apresentação integrada às demos (ver README).
- Revisão do `server.js`: respostas de erro sem stack trace, validação de tipo/tamanho nas rotas seguras, JWT com algoritmo fixo (HS256) e esquema `Bearer`, `timingSafeEqual` na comparação do token CSRF, `X-Powered-By` desligado, `express.static` com caminho absoluto, segredo do JWT por variável de ambiente (`JWT_SECRET`), limite de tamanho do corpo e `POST /api/reset` (localhost).
- As rotas **vulneráveis** continuam vulneráveis de propósito (SQL Injection, XSS armazenado, CSRF via GET, força bruta sem limite).
