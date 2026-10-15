# Laboratório de Segurança Web — Grupo 3

Laboratório prático desenvolvido para o seminário de **Segurança e Auditoria de Sistemas** (Anhanguera), Unidade 3 — Segurança Web e Pentest.

Cada vulnerabilidade tem duas versões rodando lado a lado: uma **vulnerável** e uma **segura**, para comparação direta durante a apresentação.

## Como rodar

```bash
npm install
node server.js
```

Acesse: http://localhost:3000

## Demonstrações

### 1. SQL Injection
- **Vulnerável:** `/vulneravel/login` monta a query concatenando a entrada do usuário.
- **Segura:** `/seguro/login` usa Prepared Statements (`?` como parâmetro).
- **Ataque:** no campo de e-mail, usar `admin@empresa.com' --`.

### 2. XSS (Cross-Site Scripting)
- **Vulnerável:** `/vulneravel-comentarios.html` renderiza comentários com `innerHTML`.
- **Segura:** `/seguro-comentarios.html` usa `textContent` + header `Content-Security-Policy`.
- **Ataque:** comentar `<img src=x onerror="alert('XSS')">`.

### 3. CSRF (Cross-Site Request Forgery)
- **Vulnerável:** `/vulneravel/trocar-email` aceita `GET` sem checar origem do pedido.
- **Segura:** `/seguro/trocar-email` só aceita `POST` com token CSRF.
- **Ataque:** abrir `ataque-evil.html` (fora da pasta `public/`, simula um site externo) enquanto logado em `/csrf/login.html`.

### 4. Força Bruta
- **Vulnerável:** `/vulneravel-forca-bruta/login` sem limite de tentativas.
- **Segura:** `/seguro-forca-bruta/login` com rate limiting (3 tentativas/minuto).
- Demo em `/forca-bruta.html`.

### 5. JWT (proteção de API)
- `/api/perfil` exige token válido no header `Authorization: Bearer <token>`.
- Sem token → `401`. Demo em `/jwt.html`.

## Stack

Node.js, Express, better-sqlite3, cookie-parser, express-rate-limit, jsonwebtoken.

## Aviso

Laboratório educacional. Todas as "vulnerabilidades" são intencionais, isoladas em `localhost`, para fins de demonstração em sala de aula.
