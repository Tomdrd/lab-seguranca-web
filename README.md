# Laboratório de Segurança Web — Grupo 3

Laboratório prático desenvolvido para o seminário de **Segurança e Auditoria de Sistemas** (Anhanguera), Unidade 3 — Segurança Web e Pentest.

Cada vulnerabilidade tem duas versões rodando lado a lado: uma **vulnerável** e uma **segura**, para comparação direta durante a apresentação.

## Como rodar

Requisitos: Node.js 20 ou superior e npm.

```bash
npm install
npm start
```

Acesse http://localhost:3000. O site auxiliar da demonstração CSRF usa a porta 3001; deixe-a disponível.

Para executar os testes automatizados: `npm test`.

> **Importante:** este é um laboratório didático, não um sistema pronto para produção. As rotas vulneráveis são intencionais. Execute somente localmente e nunca exponha as portas à internet.

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
- **Ataque:** logado em `/csrf/login.html`, abrir a conta vulnerável e clicar em **Abrir site malicioso** (serve o `ataque-evil.html` em `http://localhost:3001`, outra origem, como um site externo). O arquivo fica fora de `public/` de propósito. Também funciona abrindo `ataque-evil.html` direto do disco.

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

## Checklist de segurança e limitações

- **Credenciais:** senhas em texto puro e banco em memória são exclusivamente didáticos. Sistemas reais devem armazenar hashes lentos com salt, como Argon2id ou bcrypt.
- **Logs:** não registre senhas, tokens, cookies nem consultas com credenciais. O laboratório omite segredos e mascara e-mails nos eventos de autenticação.
- **JWT:** HS256 é fixado e os tokens expiram em 15 minutos. JWT é assinado, não criptografado; seu payload pode ser lido. Autenticação não substitui autorização. Em produção, configure `JWT_SECRET` forte (mínimo de 32 caracteres neste exemplo) fora do código; o servidor falha ao iniciar em modo `production` sem ele.
- **CSRF:** o cookie é permissivo no modo local para tornar o ataque observável. Em produção, use HTTPS e configure `Secure`, `HttpOnly` e `SameSite=Lax` ou `Strict` conforme o fluxo, além de token anti-CSRF quando aplicável.
- **Rate limit:** o limitador em memória e por IP é didático. Sistemas distribuídos precisam de armazenamento compartilhado e convém combinar controles por conta, MFA e monitoramento.
- **XSS/CSP:** prefira `textContent` para dados não confiáveis, faça escape contextual ao inserir dados em HTML e trate CSP como defesa adicional, não como substituto da codificação segura.
- **Pentest:** defina escopo e autorização por escrito, preserve evidências, avalie impacto, documente achados e reteste correções. Revise dependências e execute `npm audit`.

## Mini-auditoria de acessos

O arquivo `exercicios/mini-auditoria-acessos.csv` contém dados fictícios para classificar como **alerta**, **necessita investigação** ou **inconclusivo**. Justifique com evidências e o princípio do menor privilégio. Horário incomum, isoladamente, não prova ataque. Proponha contenção, investigação e prevenção.

## Testes

A suíte com `node:test` verifica SQL parametrizado, validação de comentários, token CSRF, autenticação/autorização JWT e bloqueio por excesso de tentativas. Execute `npm test`.

## Apresentação (slides)

Com o servidor rodando, abra **http://localhost:3000/slides.html**.

- Navegação: `→` / `Espaço` avançam (revelando as etapas de cada slide), `←` volta, `Home`/`End`, `F` tela cheia, `T` tema, `R` reinicia as demos. Dá para abrir direto num slide com `#N` (ex.: `/slides.html#9`).
- Todas as demos rodam dentro dos slides, em passos, chamando as mesmas rotas do laboratório (sem abrir abas):
  - **XSS:** a etapa 1 publica o comentário na versão vulnerável, isolada em sandbox; feche o alerta. A etapa 2 testa o mesmo HTML com `innerHTML` apenas no painel protegido por CSP, sem recarregar o painel vulnerável. O painel seguro padrão insere o comentário com `textContent` e também aplica CSP.
  - **CSRF:** o botão "A vítima abre o site malicioso" carrega o `ataque-evil.html` da porta 3001 num quadro invisível e o e-mail da conta muda sem nenhum clique. Se a 3001 estiver ocupada, a demo usa um plano B equivalente.
- `POST /api/reset` (aceito só de localhost) limpa comentários, sessões e o limite de tentativas. É o que o botão e a tecla `R` usam entre um ensaio e a apresentação.

## Referências e leituras recomendadas

Referências organizadas em formato próximo ao padrão ABNT. Acesso em: 27 out. 2026.

### Vulnerabilidades e prevenção

1. OWASP FOUNDATION. [SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html).
2. OWASP FOUNDATION. [Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html).
3. OWASP FOUNDATION. [Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Request_Forgery_Prevention_Cheat_Sheet.html).
4. OWASP FOUNDATION. [Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).
5. OWASP FOUNDATION. [Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/).

### Proteções do navegador, GitHub e Vercel

6. MOZILLA DEVELOPER NETWORK (MDN). [Utilizando Políticas de Segurança de Conteúdo (CSP)](https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Guides/CSP).
7. GITHUB. [GitHub Actions documentation](https://docs.github.com/en/actions).
8. VERCEL. [Web Application Firewall](https://vercel.com/security/web-application-firewall).
9. VERCEL. [WAF Managed Rulesets](https://vercel.com/docs/vercel-firewall/vercel-waf/managed-rulesets).

### Referência do projeto prático

10. TOMDRD. Lab Segurança Web. GitHub. Disponível em: [https://github.com/Tomdrd/lab-seguranca-web](https://github.com/Tomdrd/lab-seguranca-web). Acesso em: 27 out. 2026.
