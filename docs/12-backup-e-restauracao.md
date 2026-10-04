# Backup e restauração (D-05, D-34)

Há duas camadas de backup:

| Camada | Onde | Frequência | Retenção | Cobre |
|---|---|---|---|---|
| Supabase Pro (automático) | Supabase | diária | 7 dias | banco inteiro, restaura pelo painel do Supabase |
| **Backup extra** (este doc) | Cloudflare R2 (outro fornecedor) | diária, 3h de Brasília | 30 dias | conteúdo do portal (`public`, `interno`), usuários do login e índice do Storage |

O backup extra existe para o caso de perder a conta ou o projeto do Supabase. Ele **não copia os arquivos** (PDFs e imagens, vários GB); eles ficam no Storage do Supabase (pendência: cópia periódica para o R2).

## Como funciona
Workflow `.github/workflows/backup-banco.yml` (GitHub Actions), todo dia e sob demanda (*Actions → Backup do banco → Run workflow*):
1. `pg_dump` (cliente 17, igual ao servidor) da produção e, se configurada, da homologação.
2. Contagem de linhas das tabelas principais na origem.
3. Criptografia (GPG, AES-256, senha `BACKUP_SENHA`) e envio para `s3://<bucket>/<ambiente>/<AAAA-MM-DD>/backup.tar.gpg` no R2.
4. **Teste de restauração** num Postgres 17 descartável: restaura e compara as contagens. Se não bater, o workflow falha e o GitHub avisa por e-mail quem tem acesso ao repositório.

Retenção de 30 dias: regra de ciclo de vida do bucket no R2 (apaga sozinho).

## Configuração (uma vez)
1. **Ativar o R2** na conta Cloudflare (*R2 Object Storage → Purchase/Enable*). O plano grátis cobre 10 GB; um backup de Jeriquara tem poucos MB.
2. **Bucket e retenção** (a SECKE roda, logada no wrangler):
   ```bash
   npx wrangler r2 bucket create portal-municipal-backups --location enam
   npx wrangler r2 bucket lifecycle add portal-municipal-backups expirar-30-dias --expire-days 30 --force
   ```
3. **Token do R2** (*R2 → Manage API tokens → Create API token*): permissão *Object Read & Write*, só no bucket `portal-municipal-backups`. Guardar o *Access Key ID* e o *Secret Access Key*.
4. **Conexão do banco**: no Supabase, *Connect → Session pooler* (porta 5432; a conexão direta é só IPv6 e o GitHub Actions usa IPv4). Copiar a URI e pôr a senha do banco no lugar de `[YOUR-PASSWORD]`. Repetir na branch de homologação, se quiser backup dela também.
5. **Segredos no GitHub** (a pessoa digita os valores; não colar em chat nem em arquivo):
   ```bash
   gh secret set SUPABASE_DB_URL_PRODUCAO
   gh secret set SUPABASE_DB_URL_HOMOLOGACAO     # opcional
   gh secret set R2_ACCESS_KEY_ID
   gh secret set R2_SECRET_ACCESS_KEY
   gh secret set BACKUP_SENHA                    # senha forte; guardar também no cofre de senhas da SECKE
   gh variable set R2_ACCOUNT_ID --body f31ad28ba4df683d99b5c51e8c95c570
   gh variable set R2_BUCKET --body portal-municipal-backups
   ```
   **Sem a `BACKUP_SENHA` não há como abrir nenhum backup.** Ela precisa existir fora do GitHub.
6. Rodar uma vez à mão (*Actions → Backup do banco → Run workflow*) e conferir o passo "Teste de restauração".

## Restaurar
1. Baixar o arquivo do dia no painel do R2 (ou `aws s3 cp s3://portal-municipal-backups/producao/AAAA-MM-DD/backup.tar.gpg . --endpoint-url https://<conta>.r2.cloudflarestorage.com`).
2. Abrir: `gpg -d backup.tar.gpg | tar -xf -` (pede a `BACKUP_SENHA`). Saem `banco.dump`, `auth-storage.dump`, `auth-storage-estrutura.sql` (estrutura das tabelas de login e Storage, para restaurar fora do Supabase) e `contagens.txt`.
3. **Num projeto Supabase novo** (o caminho normal, se o projeto foi perdido): o dump já tem tabelas, funções, gatilhos e políticas, então não é preciso rodar as migrations. Antes, ligar as extensões que o banco usa (SQL Editor: `create extension if not exists unaccent schema extensions; create extension if not exists pg_trgm schema extensions; create extension if not exists pg_net; create extension if not exists pg_cron;`) e então restaurar:
   ```bash
   # Primeiro os usuários do login e o índice do Storage (perfis e membros dependem deles):
   pg_restore -d "<URI do Session pooler do projeto novo>" --data-only --disable-triggers auth-storage.dump
   # Depois o conteúdo:
   pg_restore -d "<URI>" --no-owner --no-privileges --clean --if-exists banco.dump
   ```
   Depois, refazer o que não está no banco: Edge Functions, segredos do Vault (D-30), `interno.configuracao` (D-31), Auth URLs e arquivos do Storage.
4. **Só uma tabela ou um registro** (ex.: notícia apagada por engano): restaurar num Postgres local e copiar o que falta, ou usar o backup do próprio Supabase (mais simples para os últimos 7 dias).

Conferir sempre com `contagens.txt`.
