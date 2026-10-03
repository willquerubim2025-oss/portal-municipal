# Pendências e próximos passos

*Atualizar este arquivo sempre que algo for resolvido (mover para "Concluído", com data) ou surgir.*

## Próximos passos
- [ ] **URGENTE: controle de versão (03/10/2026).** O projeto não está em git: portal, painel, migrations e ferramenta de migração existem só nesta pasta. Criar repositório **privado** no GitHub (conta da SECKE), iniciar o git sem `.env`, chaves ou `node_modules`, e enviar. Também é pré-requisito do backup `pg_dump` → R2 por GitHub Action (D-05) e da publicação automática.
- [ ] Ordem sugerida antes da reunião: 1) git + GitHub; 2) limite de upload 200 MB + migração completa na homologação; 3) publicar a homologação na Cloudflare (`npx wrangler login` pelo usuário) para mostrar à prefeitura.
- [ ] Homologação: definir o domínio de homologação do portal e criar no Auth **da branch** os usuários de teste (o Auth da branch é separado: o usuário da SECKE da produção não existe lá).
- [ ] **Conta Cloudflare (03/10/2026):** o usuário tem conta grátis. Usar para a homologação. **Antes de Jeriquara ir ao ar, ativar o Workers Paid (US$ 5/mês por conta, cobre todos os municípios).** No Free: 100 mil requisições/dia somadas de todos os municípios e **10 ms de CPU por requisição**; passar disso dá erro ao visitante, não lentidão. Paid: 10 mi requisições + 30 mi ms de CPU por mês, até 30 s por requisição. Domínios das prefeituras via **Cloudflare for SaaS** (custom hostnames): 100 grátis, depois US$ 0,10/mês cada; a prefeitura só cria um CNAME, sem transferir o DNS. Avaliar se a conta deve ficar no e-mail da SECKE (produto da empresa).
- [ ] Tema ampliado (D-17), junto com o painel: home por blocos (`config.home.blocos`), variações de cabeçalho e de cartões, fontes auto-hospedadas; validação de contraste das cores no painel; documentar o formato em `docs/03`.
- [ ] Portal (fase 2): publicar o Worker na Cloudflare (conta, `wrangler deploy`, variáveis) e apontar um domínio de homologação; cache na borda + purge ao publicar; otimização de imagens (Supabase Image Transformations ou Cloudflare Images, `srcset`); revisar a sessão KV que o adaptador liga por padrão (o portal não usa sessão); `astro check` (instalar `@astrojs/check`); medir Core Web Vitals (`web-perf`); validar dados estruturados no Rich Results Test; teste com leitor de tela (NVDA).
- [ ] Painel: tela de acompanhamento PNTP (depende de carregar `pntp_criterios`); importação em lote de redirecionamentos (CSV), junto com o script de migração.
- [ ] **E-mail do sistema (SMTP próprio) nos dois projetos Supabase:** sem isso, convites e "esqueci minha senha" não chegam por e-mail a quem não é da equipe (hoje o convite devolve um link para repassar). Opções: Cloudflare Email Service, Resend, Amazon SES ou o e-mail da SECKE. Configurar em Authentication → Emails → SMTP, com remetente do domínio da SECKE e SPF/DKIM.
- [ ] **Auth na produção:** cadastrar em Authentication → URL Configuration o endereço do painel publicado (Site URL e Redirect URLs `https://<painel>/redefinir-senha`). Sem isso, o link de convite volta para o endereço padrão.
- [ ] Exportação completa por município (RF19): Edge Function + tela no painel (tabela `exportacoes` já existe).
- [ ] Homologação: apagar usuários de teste criados pelo `e2e/administracao.mjs` (`novo.e2e.*@exemplo.gov.br`, e o `debug.*`) junto com os itens "E2E".
- [ ] Painel: pré-visualização de rascunho no portal (hoje o portal só mostra o publicado); biblioteca de mídias para reaproveitar imagens; publicar o painel (Cloudflare Workers static assets ou Pages); gerenciar categorias pelo painel (hoje só as do provisionamento).
- [ ] Acessibilidade do painel: auditoria automática com axe (`@axe-core/playwright`) em todas as telas, dentro do `npm run e2e`.
- [ ] Homologação: apagar os itens de teste com "E2E" no título e o conteúdo **fictício de exemplo** (`legado.exemplo = true`: notícias, documentos, serviços, eventos, perguntas e o alerta). As exclusões em lote foram recusadas pelas permissões desta sessão (03/10/2026); dá para apagar pelo painel. Não afeta a produção.
- [ ] Edge Functions: verificação de links (RF18), exportação (RF19), export diário por município.
- [ ] GitHub Action: `pg_dump` diário → R2, com retenção de 30 dias + teste de restauração.
- [ ] Monitoramento de disponibilidade (UptimeRobot ou Better Stack).
- [ ] **Aumentar o limite de upload do Storage** nos dois projetos Supabase (Storage → Settings → "Upload file size limit", ex.: 200 MB). Na amostra, 6 PDFs escaneados/assinados passaram de 50 MB e não migraram.
- [ ] **Validar com a prefeitura o mapa da migração** (`docs/reuniao/02-migracao-do-site-atual.md`): boletins, temas das notícias, o que descartar (coluna Destino), vigência das leis.
- [ ] Migração completa na homologação (`--todos`, algumas horas, ~8 GB), depois `limpar-orfas.mjs`; páginas (129, com duplicadas) numa etapa própria, após a validação da coluna Destino.
- [ ] Revisar aos poucos os textos alternativos automáticos das imagens migradas (`midias.legado.alt_automatico = true`; 552 só na amostra). Ideia: filtro no painel.
- [ ] Usuário dedicado da SECKE para a migração na produção (aparece na auditoria).
- [ ] Salvar uma cópia do PDF de requisitos em `docs/`.


- [ ] SEO no portal: seguir o checklist do doc 09 (sitemap e robots por domínio, canônico, `noindex` na homologação, metadados, Open Graph, JSON-LD, imagens otimizadas, Search Console por município).
- [ ] Migration futura (com o painel): `midias.largura`/`altura`; documentar o formato de `municipios.config.seo`.
- [ ] Jeriquara: escolher o domínio canônico (com ou sem `www`) e obter acesso ao Search Console / DNS (junto da pergunta sobre o Registro.br).

## Pendências técnicas do banco
- [ ] Desempenho (Performance Advisor, 02/10/2026; nada urgente com o volume atual): ~56 FKs sem índice de cobertura (principalmente as compostas e `criado_por`/`atualizado_por`) e ~26 casos de várias policies permissivas para o mesmo papel e ação. Criar índices nas FKs mais usadas e consolidar policies numa migration quando o portal e o painel estiverem consultando de verdade.
- [ ] Segurança (aviso aceito, ver doc 03 > Permissões): mover `is_plataforma()`/`tem_papel()` para um schema não exposto na Data API.
- [ ] Carregar `pntp_criterios` com a matriz PNTP vigente e **conferir os nomes das 18 seções padrão da Central** (`provisionar_municipio`) com as dimensões dessa matriz.
- [ ] Revisar os textos-guia das 6 páginas padrão do provisionamento (hoje é uma frase cada) e decidir se a SECKE oferece um modelo completo (ex.: política de privacidade).
- [ ] Portal e painel precisam respeitar `config.modulos` (esconder menu e rotas do módulo desligado), `publicacoes.expira_em` e `destaques.fim_em` (as regras ficam na consulta, não no RLS).
- [ ] Prioridade baixa do doc 08: Diário Oficial próprio, câmaras como cliente (`municipios.tipo`), `config.fuso_horario`, ampliar `sistemas_externos.categoria`.
- [ ] Criação de usuários pelo admin do município: Edge Function com service_role (convite por e-mail) + linha em `membros`.
- [ ] Definir como o Astro invalida o cache ao publicar (webhook do banco → purge no Cloudflare).

## Perguntas para a reunião inicial com o Município
Tudo o que precisa ser levantado com a prefeitura está organizado em **[docs/reuniao/](reuniao/00-LEIA-PRIMEIRO.md)**: guia e pauta (00), acessos e domínio (01), migração (02), transparência e sistemas (03), dados e conteúdo institucional (04), identidade visual (05), usuários, suporte e contrato (06). **Ao incluir uma nova pergunta para a prefeitura, colocar lá**, no arquivo do assunto.

## Concluído
- 02/10/2026: análise de requisitos e viabilidade (doc 01).
- 02/10/2026: inventário do site atual (doc 05, planilha e JSON).
- 02/10/2026: schema multi-prefeitura 0001–0006 + seed + 23 testes de RLS.
- 02/10/2026: análise de capacidade multi-prefeitura (doc 04).
- 02/10/2026: documentação, CLAUDE.md e registro de decisões.
- 02/10/2026: revisão do schema como base genérica (doc 08). Corrigidos isolamento entre municípios (D-11), brechas da D-09 em arquivos e Storage, `atualizado_por`, auditoria de `municipios`, limite 120 fixo e `(select auth.uid())`. Testes: 23 → 34.
- 03/10/2026: material da reunião com a prefeitura reorganizado em `docs/reuniao/` (D-24).
- 03/10/2026: ferramenta de migração (D-23) em `migracao/` + mapa proposto de Jeriquara (`docs/reuniao/02-migracao-do-site-atual.md`). Amostra de 50 notícias + 50 documentos na homologação: 820 arquivos (1,1 GB), 0 erros, repetição sem duplicar, redirecionamentos conferidos no portal.
- 03/10/2026: painel (fase 4, D-21): usuários (convite pela Edge Function `convidar-usuario`, papel, desativar/reativar), chamados (abertura, conversa, nota interna da SECKE, situação, consumo do saldo, relatório mensal), auditoria (quem, o quê, quando e o que mudou). Edge Function publicada na homologação e na produção. e2e `administracao.mjs` 25/25, inclusive o convidado abrindo o link, criando a senha e entrando com o papel certo. Bateria completa do painel: 98/98.
- 03/10/2026: painel (fase 3, D-20): estrutura organizacional (árvore, responsável, foto), menus (principal, rodapé, atalhos; subitens; menu padrão), Central de Transparência (seções, itens, sistemas externos), identidade visual e dados (cores com validação de contraste, brasão, imagem de compartilhamento, contatos, redes, módulos, Search Console), categorias e redirecionamentos. Migration 0010 (trava dos dados oficiais do município) na homologação e na produção; testes de banco 66/66; e2e `estrutura.mjs` 24/24 (+ notícias 19/19, conteúdo 30/30). Corrigidos: dois campos "Nome" no formulário de órgão, mensagem de sucesso sumindo ao criar, redirecionamento em dois saltos no portal.
- 03/10/2026: painel (fase 2, D-19): documentos e legislação (tipo, número, ano, data, ementa, vigência, campos extras, arquivos, relações), páginas hierárquicas, Carta de Serviços, agenda, perguntas frequentes, banners e alertas; lógica comum `useEdicao` + lista genérica; testes no repositório (`painel/e2e`, `npm run e2e`): notícias 19/19 + conteúdo 30/30, incluindo conferência no portal. Corrigidos: texto de ajuda dentro do rótulo (acessibilidade), campos esticados na coluna lateral, mensagem crua do banco ao publicar banner sem imagem.
- 03/10/2026: painel (fase 1) em `painel/` (D-18): login, recuperação e redefinição de senha, seletor de prefeitura, menu por papel, início com indicadores e saldo do contrato, módulo de Notícias completo (lista com filtros, editor TipTap, imagem de destaque e galeria com texto alternativo obrigatório, categorias, órgão, destaque, expiração, rascunho/publicar/agendar/despublicar/excluir). Teste ponta a ponta no navegador (Playwright): 19/19. Corrigido no teste: após "Sair", o próximo usuário caía na página do anterior.
- 03/10/2026: portal público (fase 1) em `portal/` (D-16): middleware multi-prefeitura (domínio, canônico, 301 do WordPress, `noindex` na homologação), layout acessível (atalhos eMAG, alto contraste), home, notícias, documentos, legislação com vigência, serviços, agenda, perguntas frequentes, estrutura organizacional, transparência, busca, páginas institucionais, 404, sitemap e robots, com JSON-LD (NewsArticle, Legislation, Event, FAQPage, GovernmentService, GovernmentOrganization, BreadcrumbList). Todas as rotas testadas contra a homologação (conteúdo de exemplo + domínio de teste `jeriquara.homologacao.teste`).
- 02/10/2026: branch `homologacao` criada pelo usuário no painel (`kvilgamsyneenjtlllcf`, D-14). Recebeu as migrations 0001–0009 (34 tabelas, todas com RLS, mesmos GRANTs da produção) e o seed de Jeriquara (21 categorias, 6 páginas, 18 seções e 16 itens na Central, 3 menus, 5 sistemas, 1 contrato).
- 02/10/2026: primeiro usuário da SECKE (William, willquerubim2025@gmail.com) criado no Auth pelo usuário e cadastrado em `equipe_plataforma` + `perfis`. Conferido com a sessão simulada: acesso de plataforma, vê rascunhos e contratos, saldo 120.
- 02/10/2026: projeto Supabase **Portal Municipal** criado pelo usuário (`qgywucdnaeheqndcxtho`, sa-east-1, Pro, exposição automática de tabelas desligada, RLS automático ligado). Aplicadas as migrations 0001–0009 + seed de Jeriquara. Permissões conferidas no banco real; Security e Performance Advisors revisados (D-13). Testes: 55 → 62.
- 02/10/2026: módulos genéricos de prioridade alta e média (migration 0007, D-12): órgãos, perguntas frequentes, provisionamento, legislação com vigência, destaques, galeria, eventos, expiração, módulos por município. Testes: 34 → 55.
