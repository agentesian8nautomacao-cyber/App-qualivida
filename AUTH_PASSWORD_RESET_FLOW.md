## Fluxo de Recuperação de Senha (Forgot Password)

Este documento descreve o fluxo completo de **recuperação e redefinição de senha** do app Gestão Qualivida Club Residence.  
Objetivo: fluxo simples para o usuário, mas **seguro, rastreável e previsível** – “relógio suíço”.

---

### Visão geral

- **Entrada do fluxo**: link `Esqueci minha senha` na tela de login (`Login.tsx`).
- **Entrega do link**: e-mail transacional com URL única:
  - `https://app.qualivida.com/reset-password?token=XXXX`
- **Saída do fluxo**: usuário redefine a senha, token é invalidado e ele volta para o login.

Principais arquivos:

- **Frontend (React)**
  - `components/Login.tsx`
  - `components/ForgotPassword.tsx`
  - `services/userAuth.ts`
- **Backend / API**
  - `api/request-password-reset.ts`
- **Banco de dados**
  - `supabase_schema.sql` (tabela `users`)
  - `supabase_password_reset_tokens.sql` (tabela `password_reset_tokens`)

---

### 1. Tabelas e modelo de dados

**Usuário administrativo**

- Tabela: `users`
- Campos relevantes:
  - `id` (UUID)
  - `username`
  - `password_hash` (senha hash; nunca texto puro)
  - `role` (`PORTEIRO` | `SINDICO`)
  - `email`
  - `is_active`

**Tokens de recuperação**

- Tabela: `password_reset_tokens` (definida em `supabase_password_reset_tokens.sql`)
- Campos principais:
  - `id` (UUID)
  - `user_id` (FK → `users.id`)
  - `token` (**hash SHA‑256 do token bruto**, nunca o token em texto puro)
  - `expires_at` (TIMESTAMPTZ) – hoje configurado para **+15 minutos**
  - `used` (BOOLEAN)
  - `created_at` (TIMESTAMPTZ)
- Índices e políticas:
  - Índices para `user_id`, `token`, `expires_at`, `used`.
  - RLS liberada para criação, leitura por token e update (para marcar `used`).
  - Função opcional `cleanup_expired_tokens()` para limpeza periódica.

---

### 2. Geração do token + envio de e-mail

**Endpoint**: `POST /api/request-password-reset`  
Arquivo: `api/request-password-reset.ts`

Passos principais:

1. **Entrada**: `emailOrUsername` (string).  
   - Normalizado em minúsculas; se vazio → `400` com mensagem amigável.
2. **Busca de usuário ativo**:
   - `users` filtrando por `username` ou `email`, `is_active = true`.
   - Em caso de erro / usuário inexistente / sem e‑mail:
     - Retorna **sempre** `200` com mensagem neutra:
       - “Se o usuário existir e tiver email cadastrado, você receberá instruções de recuperação.”  
     - **Nunca** confirma se o e‑mail ou usuário existe.
3. **Rate limit** (por usuário):
   - Busca último token por `user_id` ordenado por `created_at` desc.
   - Se a última solicitação for **menor que ~2 minutos**:
     - Não gera novo token.
     - Retorna a mesma mensagem neutra de sucesso.
4. **Invalidar tokens anteriores**:
   - Marca como `used = true` todos os tokens ativos daquele `user_id` antes de criar um novo.
5. **Geração do token**:
   - Gera 32 bytes aleatórios (`crypto.randomBytes(32)`).
   - Converte para string hex (`token` bruto, **não salvo em texto puro**).
   - Calcula `tokenHash = SHA‑256(token)` e **salva somente o hash** no banco.
   - Define `expires_at = now() + 15 minutos`.
6. **Insert em `password_reset_tokens`**:
   - `user_id`, `token: tokenHash`, `expires_at`, `used: false`.
7. **Envio de e‑mail (Resend)**:
   - Depende de:
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `RESEND_API_KEY`
     - `APP_URL` / `VITE_APP_URL` / `VERCEL_URL`
   - Monta o link:
     - `${appUrl}/reset-password?token=${encodeURIComponent(tokenBruto)}`
   - Corpo do e‑mail:
     - Saudação com nome/username.
     - Explica que foi solicitada recuperação.
     - Botão “Redefinir senha” com o link.
     - Texto com URL em plain text.
     - Aviso: **link expira em 15 minutos** e para ignorar caso não tenha solicitado.
8. **Logs de segurança**:
   - `console.info('[AUTH-EVENT] Password reset requested', { userId, username, email, expiresAt, at })`

Fallback (quando falta config de e‑mail / ambiente de desenvolvimento):

- A tela de frontend (`ForgotPassword.tsx`) tenta primeiro chamar `/api/request-password-reset`.
- Se falhar, usa `generatePasswordResetToken()` em `services/userAuth.ts`:
  - Mesmo conceito: token randômico, hash SHA‑256 salvo no banco.
  - `expires_at = now() + 15 minutos`.
  - Exibe o token **bruto no console** para testes manuais **apenas em DEV**.

---

### 3. Validação do token e redefinição da senha

**Validação do token**  
Arquivo: `services/userAuth.ts` → `validateResetToken(token: string)`

1. Recebe o **token bruto** vindo do link ou do campo manual.
2. Calcula `tokenHash = SHA‑256(token)` usando Web Crypto (`crypto.subtle`).
3. Busca em `password_reset_tokens` por `token = tokenHash`.
4. Regras de validação:
   - Se não encontrar → `valid: false`, mensagem “Token inválido ou não encontrado.”
   - Se `used = true` → `valid: false`, mensagem “Este token já foi utilizado.”
   - Se `expires_at < now()` → `valid: false`, mensagem “Este token expirou. Solicite uma nova recuperação de senha.”
   - Caso contrário → `valid: true`, retorna `userId`.

**Regras de senha forte**  
Função: `isStrongPassword(password: string)` em `userAuth.ts`:

- Mínimo **8 caracteres**.
- Pelo menos:
  - 1 letra **maiúscula**,
  - 1 letra **minúscula**,
  - 1 **número**,
  - 1 **caractere especial** (`[^A-Za-z0-9]`).

**Redefinição da senha**  
Função: `resetPasswordWithToken(token: string, newPassword: string)`

1. Aplica `isStrongPassword(newPassword)`:
   - Se não atender → retorna erro com texto claro.
2. Chama `validateResetToken(token)`:
   - Se inválido/expirado/já usado → retorna mensagem específica.
3. Calcula hash da nova senha com `hashPassword`:
   - Web Crypto (`SHA‑256`) em HTTPS ou localhost.
   - Mantém o comportamento legado (`plain:`) apenas onde já é usado.
4. Atualiza `users.password_hash` e `updated_at` para o `user_id` do token.
5. Marca o token como `used = true`.
6. Busca `username` desse usuário e reseta tentativas de login (`resetLoginAttempts(username)`).
7. Loga evento:
   - `console.info('[AUTH-EVENT] Password reset completed', { userId, username, at })`
8. Retorna mensagem: **“Senha redefinida com sucesso! Você já pode fazer login.”**

---

### 4. UX e fluxo no frontend

**Tela de Login**  
Arquivo: `components/Login.tsx`

- Link **“Esqueci minha senha”** abre o componente `ForgotPassword` em modo modal para Portaria/Síndico.
- Detecta link de redefinição:
  - Padrão antigo: `/?reset=1&token=XXXX`
  - Padrão novo: `/reset-password?token=XXXX`
- Se encontrar um `token` em qualquer um dos formatos:
  - Abre `ForgotPassword` diretamente no passo de **redefinição** (`initialStep="reset"`).
  - Passa `initialToken` para o componente (não precisa digitar token).
  - Força `selectedRole = 'PORTEIRO'` (fluxo administrativo).
  - Normaliza a URL de volta para `/` (sem query com token) via `history.replaceState`.

**Tela de Esqueci minha senha**  
Arquivo: `components/ForgotPassword.tsx`

Passo 1 – Solicitar link:

- Campo único:
  - `type="email"`, placeholder **“E-mail cadastrado”**.
  - Validação de formato de e‑mail cliente‑side.
- Chamada principal: `POST /api/request-password-reset` com `{ emailOrUsername: email }`.
- Mensagens:
  - Sucesso (sempre neutra): “Se o usuário existir e tiver email cadastrado, você receberá um link por email. Verifique a caixa de entrada e o spam.”
  - Erros de campo: e‑mail vazio / formato inválido.
- Comportamento em dev sem e‑mail configurado:
  - Usa `generatePasswordResetToken` como fallback.
  - Mostra mensagem orientando a buscar o token no console e ir para o passo de redefinição.
- Botão com loading spinner e desabilitado enquanto requisita.

Passo 2 – Redefinir senha:

- Se veio de link com `initialToken`:
  - Campo de token **não é exibido**.
  - O token vem diretamente da URL.
- Se for fluxo manual (DEV):
  - Campo de token é exibido para digitação.
- Campos de senha:
  - Nova senha (com toggle de ver/ocultar).
  - Confirmar nova senha.
  - Placeholders deixam claro o requisito: mínimo 8 caracteres, com maiúscula, minúscula, número e símbolo.
- Validações:
  - Regra de senha forte via `validatePasswordStrength` (espelha backend).
  - Confirmação (`newPassword === confirmPassword`).
  - Mensagens de erro curtas e objetivas.
- Chamada: `resetPasswordWithToken(tokenEfetivo, newPassword)`.
- Em caso de sucesso:
  - Mostra mensagem de sucesso vinda do serviço.
  - Aguarda ~2 segundos e volta para o login.

---

### 5. Segurança e boas práticas implementadas

- **Token nunca é armazenado em texto puro**:
  - Banco contém apenas `token` já em hash SHA‑256.
  - Usuário recebe o token bruto apenas no **link do e‑mail**.
- **Expiração curta (15 minutos)** para reduzir janela de ataque.
- **Invalidação de tokens antigos**:
  - Sempre que um novo token é gerado, os anteriores do mesmo usuário são marcados como `used`.
- **Rate limit** por usuário:
  - Mínimo ~2 minutos entre solicitações de recuperação.
- **Mensagens neutras**:
  - Em todas as etapas não se revela se o e‑mail/usuário existe ou não.
- **Regras de senha forte** aplicadas:
  - No frontend (UX) e no backend (segurança).
- **Logs de segurança**:
  - Solicitação de recuperação (`requested`).
  - Conclusão de redefinição (`completed`).
- **Defesa em profundidade**:
  - Mesmo que o frontend falhe em validar algo, o backend faz as validações críticas.

---

### 6. Como testar (checklist rápido)

**Ambiente de desenvolvimento (sem e‑mail configurado)**

1. Garantir que a tabela `password_reset_tokens` existe (rodar script SQL se necessário).
2. Rodar o app localmente.
3. Na tela de login, clicar em **“Esqueci minha senha”**.
4. Informar **e‑mail cadastrado** de um usuário válido (ex.: do síndico).
5. Verificar:
   - Mensagem neutra de sucesso.
   - Console do navegador exibindo **token de recuperação (DEV ONLY)**.
6. Copiar esse token, ir para passo de **Redefinir senha** (no modal):
   - Digitar token (se não vier de link).
   - Definir nova senha atendendo às regras.
7. Confirmar:
   - Mensagem de sucesso.
   - Login funcionando com a nova senha.
   - Token correspondente marcado como `used = true` no banco.

**Ambiente de produção (com e‑mail Resend configurado)**

1. Configurar variáveis de ambiente:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `APP_URL` / `VERCEL_URL`
2. Repetir o fluxo:
   - “Esqueci minha senha” → informar e‑mail.
   - Confirmar recebimento do e‑mail de recuperação.
   - Clicar no link `reset-password?token=...`.
3. Confirmar:
   - Tela de redefinição abre direto (sem pedir token).
   - Nova senha respeita as regras.
   - Login com nova senha funciona.
   - Link não pode ser reutilizado (token `used = true` + mensagem de token já utilizado).

---

### 7. Extensões futuras (se precisar)

Possíveis melhorias que mantêm o padrão “relógio suíço”:

- Registrar eventos de recuperação em uma tabela de auditoria (`security_events`) em vez de apenas logs de console.
- Adicionar contador e bloqueio por IP/cliente além do rate limit por usuário.
- Implementar uma UI opcional de **indicador de força da senha** (barra/score) na tela de redefinição.
- Adicionar opção de invalidar **todas** as sessões ativas daquele usuário ao redefinir a senha (se no futuro houver sessões persistentes mais robustas).

