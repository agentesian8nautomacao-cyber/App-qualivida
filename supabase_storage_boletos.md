# Storage: bucket de PDFs de boletos

Para que os PDFs importados na página **Boletos** fiquem disponíveis para visualização e para designação ao morador, é necessário criar um bucket no **Supabase Storage**.

## Passos no Supabase

1. Acesse o projeto no [Supabase Dashboard](https://supabase.com/dashboard).
2. No menu lateral, abra **Storage**.
3. Clique em **New bucket**.
4. Configure:
   - **Name:** `boletos`
   - **Public bucket:** marque como **Sim** (público), para que as URLs dos PDFs funcionem para visualização e download.
5. Salve.

Após criar o bucket `boletos` como público, a importação de boletos com PDF anexado passará a enviar os arquivos para o Storage e a salvar a URL pública no boleto. O síndico poderá visualizar e o morador terá acesso ao PDF na sua área de boletos.
