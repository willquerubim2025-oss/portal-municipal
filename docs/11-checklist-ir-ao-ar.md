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
- [ ] **Portal publicado** no Cloudflare Workers, com as variáveis `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` **da produção** (não da homologação).
- [ ] **Backup extra** (D-05): GitHub Action `pg_dump` diário → Cloudflare R2, 30 dias de retenção, **com um teste de restauração feito**.
- [ ] **Monitoramento de disponibilidade** (UptimeRobot ou Better Stack) com alerta para a equipe.
- [ ] **Verificação de links quebrados** (RF18) e **exportação completa** (RF19) funcionando.
- [ ] **Cache na borda + limpeza ao publicar**, para o portal ficar rápido sem mostrar conteúdo velho.
- [ ] Rodar os **Security e Performance Advisors** do Supabase na produção e revisar.
- [ ] Usuário dedicado da SECKE para a migração na produção (aparece como autor na auditoria).

## Por prefeitura: dados e conteúdo
- [ ] Respostas da reunião registradas (`docs/reuniao/`), com pendências e datas.
- [ ] Identidade visual e dados do rodapé preenchidos (painel → Identidade visual e dados).
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
