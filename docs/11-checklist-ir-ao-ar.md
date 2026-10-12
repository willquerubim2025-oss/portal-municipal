# Checklist: antes de colocar uma prefeitura no ar

**Uso:** conferir item por item antes da troca do domínio de cada prefeitura (o primeiro caso é Jeriquara). Os itens de **conta e infraestrutura** valem uma vez para o produto; os de **prefeitura** se repetem a cada cliente.
**Regra:** sempre que o assunto for publicação, troca de domínio ou migração final, conferir este arquivo (CLAUDE.md).

---

## ⚠️ Não esquecer (decisões adiadas de propósito)
- [ ] **Arquivos acima de 50 MB (D-26).** Hoje o teto de gastos (*spend cap*) do Supabase está **ligado**, então o upload é limitado a 50 MB e esses arquivos **não migram**. Antes da migração final, escolher:
  - (a) a prefeitura comprime e reenvia os arquivos da lista `migracao/relatorios/arquivos-grandes-<municipio>.csv` (gerada pela migração); **ou**
  - (b) desligar o teto em *Supabase → Organization → Billing → Spend cap* e criar alerta de gasto (*Usage alerts*). Depois, **rodar a migração de novo**: ela envia só os que faltaram e anexa cada um ao documento certo.
  - Conferir no relatório da última rodada: `arquivos_falha` sem nenhum "maximum allowed size".
- [ ] **Cloudflare Workers Paid (US$ 5/mês).** No plano grátis, cada página tem 10 ms de CPU e 100 mil acessos/dia somados de todas as prefeituras; passando disso o visitante vê **erro**. Ativar antes da primeira prefeitura ir ao ar.

## Contas e infraestrutura (uma vez para o produto)
- [ ] **E-mail do sistema (SMTP próprio)** nos dois projetos Supabase (*Authentication → Emails → SMTP*), com remetente do domínio da SECKE, SPF e DKIM. Sem isso, convite e "esqueci minha senha" não chegam por e-mail.
- [ ] **Painel publicado** e o endereço dele cadastrado no login da produção (*Authentication → URL Configuration*: Site URL e Redirect URL `https://<painel>/redefinir-senha`).
- [ ] **Portal publicado** no Worker `portal-municipal` (build **sem** `CLOUDFLARE_ENV`; confira na saída do deploy que `SUPABASE_URL` é `qgywucdnaeheqndcxtho`, a produção) e **painel** com `npm run deploy:producao` (D-27).
- [ ] **Backup extra** (D-05, D-34): workflow `backup-banco.yml` configurado (`docs/12-backup-e-restauracao.md`), última execução verde **com o teste de restauração passando**, e a `BACKUP_SENHA` guardada fora do GitHub.
- [ ] **Monitoramento de disponibilidade** (UptimeRobot ou Better Stack) com alerta para a equipe.
- [ ] **Migrations na produção: falta 0012, 0013, 0014** (roteiro `supabase/producao/aplicar-0012-0014.sql` no repositório `Portais-Publicos`, que também move o `pg_net` para `extensions`). Já aplicadas: 0011 e 0016–0020 em 12/10/2026, e a 0015 em 04/10/2026 (por engano de seleção no topo do Supabase; não aplicar de novo). Nenhuma delas depende de 0012–0014. Conferir com `select name from supabase_migrations.schema_migrations order by version`.
- [ ] **Verificação de links (RF18) e exportação (RF19) na produção** (D-31, D-32): migrations 0012 e 0013; Edge Functions `verificar-links` e `exportar` publicadas com `verify_jwt = false`; `interno.configuracao` com `supabase_url` = `https://qgywucdnaeheqndcxtho.supabase.co` e `ambiente` = `producao`. Testar: pedir uma verificação e uma exportação pelo painel.
- [ ] **Cache na borda (D-30) na produção:** migration 0011 aplicada; `npx wrangler secret put CACHE_SEGREDO` no Worker `portal-municipal`; no Vault da produção, `portal_cache_url` (endereço do Worker de produção) e `portal_cache_segredo` (o mesmo valor). Testar: publicar uma notícia e ver a página atualizada em até ~1 min.
- [ ] **Isolamento do cache entre prefeituras (obrigatório antes do 2º município; a SMEDU de Paulínia já está cadastrada como 2ª organização em 12/10/2026, D-37):** com dois domínios apontando para o Worker, abrir `/noticias` em cada um e conferir que cada um mostra a sua prefeitura (o cache separa pelo domínio via `ctx.props`, D-30). Na homologação só há um domínio, então isso ainda não foi testado.
- [ ] Rodar os **Security e Performance Advisors** do Supabase na produção e revisar.
- [ ] Usuário dedicado da SECKE para a migração na produção (aparece como autor na auditoria).

## Por prefeitura: dados e conteúdo
- [ ] Respostas da reunião registradas (`docs/reuniao/`), com pendências e datas.
- [ ] Identidade visual e dados do rodapé preenchidos (painel → Identidade visual e dados).
- [ ] **Depois da identidade visual:** rodar `npm run acessibilidade` (pasta `painel`) apontando `PORTAL_URL` para o portal da prefeitura: as cores do tema podem quebrar o contraste (D-33). Tem de terminar com 0 problemas.
- [ ] Páginas obrigatórias **publicadas** com o texto oficial: Acesso à Informação, e-SIC, Ouvidoria, Privacidade (com o encarregado da LGPD), Acessibilidade.
- [ ] Central de Transparência com os links de cada seção.
- [ ] Estrutura organizacional cadastrada.
- [ ] Usuários da prefeitura convidados e treinados.
- [ ] Contrato cadastrado com número e vigência (saldo de solicitações certo).
- [ ] **Nenhum dado de exemplo ou de teste na produção** (o conteúdo fictício e os itens "E2E" ficam só na homologação).

## Por prefeitura: migração
- [ ] Mapa da migração validado pela prefeitura (`docs/reuniao/02`).
- [ ] Migração completa na homologação conferida pela prefeitura (aceite).
- [ ] Item "Arquivos acima de 50 MB" resolvido (topo desta lista).
- [ ] Páginas antigas migradas ou redirecionadas.
- [ ] `limpar-orfas.mjs` rodado (sem mídias sobrando).

## Por prefeitura: qualidade
- [ ] Checklist de SEO (doc 09): sitemap, robots, canônico, Open Graph, dados estruturados validados no *Rich Results Test*.
- [ ] Acessibilidade: auditoria automática (axe) e teste com leitor de tela (NVDA) nas páginas principais.
- [ ] Velocidade: Core Web Vitals medidos no celular.
- [ ] Todos os testes passando: `node supabase/tests/rls.test.mjs` e `npm run e2e` no painel.

## Dia da troca
1. Rodada final **incremental** da migração na produção (o que foi publicado no site antigo desde a última rodada).
2. Conferir os 20 endereços antigos mais acessados (redirecionam com 301 para o lugar certo).
3. Apontar o domínio (CNAME, Cloudflare for SaaS) com a pessoa que tem acesso ao DNS.
4. Conferir HTTPS, o domínio principal (com ou sem `www`) e o redirecionamento do outro.
5. Enviar o sitemap no Google Search Console.
6. Acompanhar o monitoramento e o Search Console nos dias seguintes.
