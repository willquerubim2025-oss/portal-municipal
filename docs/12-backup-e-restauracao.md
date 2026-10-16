# Backup e restauração (D-05, D-34)

Há duas camadas de backup:

| Camada | Onde | Frequência | Retenção | Cobre |
|---|---|---|---|---|
| Supabase Pro (automático) | Supabase | diária | 7 dias | banco inteiro, restaura pelo painel do Supabase |
| **Backup extra** (este doc) | Cloudflare R2 (outro fornecedor) | diária, 3h de Brasília | 30 dias | conteúdo do portal (`public`, `interno`), usuários do login e índice do Storage |
| **Cópia dos arquivos** (D-96, seção no fim) | Cloudflare R2, bucket próprio | diária, 4h de Brasília | sem prazo (nada é apagado) | fotos, PDFs e demais arquivos dos buckets do Storage |

O backup extra existe para o caso de perder a conta ou o projeto do Supabase. O do banco **não copia os arquivos** (PDFs e imagens, vários GB): eles vão pela rotina "Backup dos arquivos", descrita no fim deste documento.

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

## Cópia dos arquivos do Storage (D-96)
Workflow `.github/workflows/backup-arquivos.yml` (*Actions → Backup dos arquivos*), todo dia às 4h de Brasília e sob demanda. Usa o **rclone** pela interface S3 do Storage do Supabase:
1. Lista os buckets do Storage do ambiente (hoje, `midias`).
2. Copia para `r2:<R2_BUCKET_ARQUIVOS>/<ambiente>/<bucket>/` só o que é novo ou mudou (a primeira vez copia tudo).
3. **Nunca apaga** no R2: arquivo excluído no portal continua na cópia.
4. Confere que tudo o que está no Storage está no R2 com o mesmo tamanho; se não bater, o workflow falha e o GitHub avisa por e-mail.

Os arquivos vão **sem criptografia**: são, na quase totalidade, os mesmos que o portal publica. Se um dia houver bucket privado com dado pessoal, criptografar antes (rclone `crypt`).

### Configuração (uma vez; a pessoa digita os valores, não colar em chat nem em arquivo)
1. **Bucket próprio no R2**, sem regra de expiração (o do banco apaga tudo com 30 dias; o workflow se recusa a usar o mesmo):
   ```bash
   npx wrangler r2 bucket create portal-municipal-arquivos --location enam
   ```
   Ou pelo painel: *R2 → Create bucket*.
2. **Token do R2:** editar o token do backup (*R2 → Manage API tokens*) e incluir o bucket `portal-municipal-arquivos` com *Object Read & Write*. Assim os segredos `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY` servem às duas rotinas.
3. **Chave S3 do Storage** em cada projeto Supabase: *Storage → S3 Configuration* (ligar "S3 protocol connection", se estiver desligado) → *Access keys → New access key*. Guardar o *Access key ID* e o *Secret access key* (aparece uma vez só). Repetir na branch de homologação, se quiser cópia dela também.
4. **Segredos e variável no GitHub** (*Settings → Secrets and variables → Actions*):
   ```bash
   gh secret set SUPABASE_S3_ID_PRODUCAO
   gh secret set SUPABASE_S3_SEGREDO_PRODUCAO
   gh secret set SUPABASE_S3_ID_HOMOLOGACAO        # opcional
   gh secret set SUPABASE_S3_SEGREDO_HOMOLOGACAO   # opcional
   gh variable set R2_BUCKET_ARQUIVOS --body portal-municipal-arquivos
   ```
5. Rodar uma vez à mão (*Actions → Backup dos arquivos → Run workflow*) e conferir as linhas "conferido".

### Restaurar arquivos
- **Um arquivo:** baixar pelo painel do R2 (`<ambiente>/midias/<organização>/...`) e reenviar pelo painel do portal, ou pelo Storage do Supabase no mesmo caminho (o índice `midias.storage_path` aponta para ele).
- **Tudo (projeto novo):** com as mesmas variáveis do workflow, rodar no sentido contrário:
  ```bash
  rclone copy r2:portal-municipal-arquivos/producao/midias supabase:midias --transfers 16
  ```
  Antes, criar o bucket `midias` (público) no projeto novo e restaurar o banco (seção "Restaurar").
