# Pendências e próximos passos

*Atualizar este arquivo sempre que algo for resolvido (mover para "Concluído", com data) ou surgir.*

## Situação geral (estimativa de 04/10/2026)
Desenvolvimento ~80% pronto; o que falta depende sobretudo da prefeitura (reunião) e da ida ao ar.

| Frente | Pronto | O que falta |
|---|---|---|
| Base (banco, RLS, multi-prefeitura) | ~97% | índices de desempenho; fase 1B das permissões (D-38) |
| Portal público (RF01–07) | ~93% | identidade visual de Jeriquara, tema ampliado (D-17) |
| Transparência (RF08–11) | ~70% | links dos sistemas Fiorilli e de cada seção (prefeitura); preencher o PNTP com a prefeitura |
| Painel (RF12–19) | ~90% | biblioteca de mídias, pré-visualização de rascunho |
| Suporte (RF20–22) | ~85% | regra de contagem da "solicitação editorial" (prefeitura) |
| Migração (RM01–05) | ~80% | validação da prefeitura, arquivos ausentes/grandes, rodada final na produção |
| Operação (cache, backup, links, exportação, acessibilidade) | ~80% | SMTP, monitoramento, Workers Paid, teste manual de acessibilidade, cópia dos arquivos |
| Ida ao ar (domínio, produção, treinamento, aceite) | ~10% | quase tudo depende da reunião |

## Próximos passos
- [ ] **Portal Educação Paulínia (layout vitrine, D-39), feito em 12/10/2026 na homologação.** Pendências:
  - publicar o portal de homologação na Cloudflare com o código novo, para ver no navegador. Até lá, testar com `DOMINIO_DEV=educacao.paulinia.teste` no `.env` do `portal/`;
  - menu principal da SMEDU cadastrado na homologação em 12/10/2026 (D-40). **Confirmar com a SMEDU** os rótulos e a ordem, e se Agenda e Transparência ficam no menu. As páginas "Matrícula Escolar" e "Fale com o supervisor" ainda não têm conteúdo real (prazos, documentos, lista de escolas);
  - brasão colorido em uso desde 12/10/2026 (`<id>/carga/brasao-colorido.png`, tema.brasao_path). O arquivo recebido tem só 252 px, e serve no cabeçalho, mas **pedir à Prefeitura o brasão oficial em alta resolução (PNG transparente ou SVG)** para o compartilhamento em redes e a impressão. A função `carga-midias-temporaria` foi reativada só para esse envio e já voltou a responder 410;
  - **carga de dados públicos da SMEDU em 12/10/2026 (homologação):**
    - 59 unidades escolares em `unidades`, com `legado.confirmar = true`;
    - contato no rodapé (`config`);
    - página Matrícula Escolar (serviço);
    - página `educacao-em-numeros`, com o card apontando para ela;
    - card "Secretaria de Educação" apontando para /estrutura-organizacional.
    O que falta confirmar com a SMEDU (supervisores, e-mail oficial, erros da lista, matrícula 2027, números, equipe e organograma) está em `docs/reuniao/smedu-dados-a-confirmar.md`, no repositório Portais-Publicos;
  - **dados fictícios na homologação da SMEDU (12/10/2026, para a apresentação):** remover antes de publicar:
    - 10 pessoas na `equipe` (resumo começa com "FICTÍCIO");
    - as fotos `carga/ficticio-*.jpg` (midias com `legado.ficticio = true`);
    - as imagens de banco `carga/foco-*.jpg` (Unsplash). **14/10/2026:** William enviou fotos novas para o "Em foco": estudantes na escadaria → Bolsa de estudo; criança chegando ao portão da escola com a família → Matrícula escolar. Os arquivos estão em `docs/design/fotos/` do repositório Portais-Publicos, e a prévia já os usa. **Falta:**
      - enviar as fotos ao Storage pelo painel (Mídias) ou por um script com rede;
      - trocar `config.home.foco[].imagem_path` e `imagem_alt` da SMEDU. Textos alternativos propostos:
        - Matrícula: "Criança com mochila de rodinhas chegando ao portão da escola, acompanhada pela família e recebida por funcionárias";
        - Bolsa: "Quatro estudantes sorrindo e conversando sentados na escadaria de um prédio, com notebook e cadernos".
      - **Antes de publicar**, confirmar a origem e o direito de uso das duas fotos. A da matrícula mostra uma criança e adultos reconhecíveis, então precisa de autorização de imagem (ECA/LGPD). A dos estudantes parece de banco de imagens ou gerada: confirmar a licença.
    - 6 eventos e 4 órgãos fictícios do calendário (`legado.ficticio = true`). Só a prova do Vestibulinho, em 18/10, é real.
    William vai enviar o material real (equipe, fotos e textos). A página "Bolsa de Estudo" (/servicos/bolsa-de-estudo) só tem a descrição genérica: faltam regras, prazos e documentos do programa;
  - o item de menu "Equipe gestora" (`/#titulo-equipe`) leva ao topo da home enquanto a equipe estiver vazia (o bloco fica oculto). Resolver quando os nomes chegarem;
  - a ferramenta `execute_sql` do MCP do Supabase trava (60 s) ao gravar HTML com listas de documentos pessoais (RG, CPF...) em texto puro. Contorno: enviar o HTML em base64 e decodificar com `convert_from(decode(...,'base64'),'UTF8')`;
  - na produção, enviar o brasão e as fotos pelo painel (Identidade visual e Mídias). Na homologação foram enviados por uma Edge Function temporária, `carga-midias-temporaria`, já desativada (responde 410) e que pode ser excluída no painel do Supabase;
  - conteúdo da homologação: 7 notícias reais do site da Prefeitura, com crédito e link. As datas são aproximadas (o site não expõe a data de cada notícia), exceto a do uniforme (9/10). Fotos com crianças, já publicadas pela Prefeitura, precisam de revisão antes de irem ao ar (ECA);
  - blocos ainda vazios na SMEDU: agenda (sem eventos) e equipe gestora (sem nomes); a busca do supervisor precisa da lista de escolas e supervisores;
  - teste manual com leitor de tela do carrossel (pausa, pontos) e dos avisos (janela urgente). Na auditoria automática (axe, WCAG 2.x A/AA), as páginas novas passaram nos modos normal e alto contraste.
- [ ] **Permissões, fase 1B (D-38):** notícias, páginas, destaques e serviços passam a usar `pode()`; os papéis antigos (admin, publicador, editor) viram papéis do sistema com as mesmas permissões; notícias ganham escopo por unidade. Os 164 testes atuais garantem que Jeriquara não muda.
- [ ] **Painel:** telas de papéis e permissões, vínculos de usuários, unidades e equipe gestora (D-38); registro de permissões no código + script de deploy que chama `sincronizar_permissoes()` com a chave de serviço; menu montado por `minhas_permissoes()`.
- [ ] **Provisionamento por `tipo_ente` (D-37):** o pacote padrão é de prefeitura (Lei Orgânica, licitações, PPA). Adaptar para secretaria, câmara etc. antes de publicar a Central de Transparência de uma organização que não é prefeitura.
- [ ] **SMEDU de Paulínia (`paulinia-educacao`):** domínio, código IBGE, CNPJ e o primeiro Administrador (papel novo; só a SECKE faz o primeiro vínculo). Detalhes no repositório `Portais-Publicos`.
- [ ] Ordem sugerida antes da reunião: 1) ~~git + GitHub~~ (D-25); 2) migração completa na homologação (em andamento, 03/10/2026); 3) ~~publicar a homologação na Cloudflare~~ (D-27).
- [ ] Homologação: definir o domínio de homologação do portal e criar no Auth **da branch** os usuários de teste (o Auth da branch é separado: o usuário da SECKE da produção não existe lá).
- [ ] **Conta Cloudflare (03/10/2026):** o usuário tem conta grátis. Usar para a homologação. **Antes de Jeriquara ir ao ar, ativar o Workers Paid (US$ 5/mês por conta, cobre todos os municípios).** No Free: 100 mil requisições/dia somadas de todos os municípios e **10 ms de CPU por requisição**; passar disso dá erro ao visitante, não lentidão. Paid: 10 mi requisições + 30 mi ms de CPU por mês, até 30 s por requisição. Domínios das prefeituras via **Cloudflare for SaaS** (custom hostnames): 100 grátis, depois US$ 0,10/mês cada; a prefeitura só cria um CNAME, sem transferir o DNS. Avaliar se a conta deve ficar no e-mail da SECKE (produto da empresa).
- [ ] Tema ampliado (D-17), junto com o painel: home por blocos (`config.home.blocos`), variações de cabeçalho e de cartões, fontes auto-hospedadas; validação de contraste das cores no painel; documentar o formato em `docs/03`.
- [ ] Portal (fase 2): publicar o Worker na Cloudflare (conta, `wrangler deploy`, variáveis) e apontar um domínio de homologação; cache na borda + purge ao publicar; otimização de imagens (Supabase Image Transformations ou Cloudflare Images, `srcset`); revisar a sessão KV que o adaptador liga por padrão (o portal não usa sessão); `astro check` (instalar `@astrojs/check`); medir Core Web Vitals (`web-perf`); validar dados estruturados no Rich Results Test; teste com leitor de tela (NVDA).
- [ ] Painel: importação em lote de redirecionamentos (CSV).
- [ ] **E-mail do sistema (SMTP próprio) nos dois projetos Supabase:** sem isso, convites e "esqueci minha senha" não chegam por e-mail a quem não é da equipe (hoje o convite devolve um link para repassar). Opções: Cloudflare Email Service, Resend, Amazon SES ou o e-mail da SECKE. Configurar em Authentication → Emails → SMTP, com remetente do domínio da SECKE e SPF/DKIM.
- [ ] **Auth na produção:** cadastrar em Authentication → URL Configuration o endereço do painel publicado (Site URL e Redirect URLs `https://<painel>/redefinir-senha`). Sem isso, o link de convite volta para o endereço padrão.
- [ ] Painel: pré-visualização de rascunho no portal (hoje o portal só mostra o publicado); biblioteca de mídias para reaproveitar imagens; publicar o painel (Cloudflare Workers static assets ou Pages); gerenciar categorias pelo painel (hoje só as do provisionamento).
- [ ] Acessibilidade, parte manual (D-33): teste com leitor de tela (NVDA + Chrome/Firefox) e navegação só por teclado no portal e no painel; a parte automática está pronta (`npm run acessibilidade`, 0 problemas).
- [ ] Cópia integral dos arquivos de um município (fim de contrato, RF19): script que baixa tudo do Storage para a pasta do município e compacta (D-32).
- [ ] Cópia periódica dos arquivos do Storage para o R2 (o backup extra só cobre o banco).
- [ ] Monitoramento de disponibilidade (UptimeRobot ou Better Stack).
- [ ] **Arquivos acima de 50 MB: decidido manter o teto de gastos (D-26); resolver antes da migração final, ver o topo de `docs/11-checklist-ir-ao-ar.md`.** Histórico: O limite de 50 MB vem do **spend cap** (teto de gastos) do Supabase; só sobe (até 500 GB) desligando o teto, o que passa a cobrar o excedente da franquia do Pro (100 GB de armazenamento, 250 GB de tráfego/mês). Opções: **A)** desligar o teto e criar alerta de gasto (Billing → Usage alerts); **B, recomendada)** manter o teto e tratar os ~25 PDFs grandes à parte (lista para a prefeitura comprimir e reenviar pelo painel; o relatório da migração já lista os que falharam por tamanho). Amostra: 6 em 1.016 PDFs (~0,6%). "Image transformation" ligado não gera custo com o teto ativo (o portal ainda não usa).
- [ ] **Validar com a prefeitura o mapa da migração** (`docs/reuniao/02-migracao-do-site-atual.md`): boletins, temas das notícias, o que descartar (coluna Destino), vigência das leis.
- [ ] Migração: páginas migradas na homologação (D-29); ajustar o mapa conforme a reunião (2.4: História oficial, departamentos, webmail) e rodar `--paginas` de novo.
- [ ] Cache (D-30): a 0011 foi aplicada na produção em 12/10/2026; falta o segredo no Worker e no Vault de lá (ver o checklist). Monitorar falhas da limpeza: a rotina não avisa quando o portal recusa (ex.: segredo errado dá 401 em `net._http_response`); incluir essa consulta no monitoramento.
- [ ] Revisar aos poucos os textos alternativos automáticos das imagens migradas (`midias.legado.alt_automatico = true`; 552 só na amostra). Ideia: filtro no painel.
- [ ] Usuário dedicado da SECKE para a migração na produção (aparece na auditoria).
- [ ] Salvar uma cópia do PDF de requisitos em `docs/`.


- [ ] SEO no portal: seguir o checklist do doc 09 (sitemap e robots por domínio, canônico, `noindex` na homologação, metadados, Open Graph, JSON-LD, imagens otimizadas, Search Console por município).
- [ ] Migration futura (com o painel): `midias.largura`/`altura`; documentar o formato de `municipios.config.seo`.
- [ ] Jeriquara: escolher o domínio canônico (com ou sem `www`) e obter acesso ao Search Console / DNS (junto da pergunta sobre o Registro.br).

## Pendências técnicas do banco
- [ ] **Avaliar (futuro) a integração GitHub do Supabase** (o painel mostra "No repository connected"; é opcional). Ela aplicaria migrations do `main` automaticamente na produção e criaria branches por pull request. **Não ligar agora:** exige migrations no padrão da CLI (`<timestamp>_nome.sql`; as nossas são `0001_...`) e tiraria o controle do fluxo homologação → produção (D-14). Reavaliar ao adotar a Supabase CLI e pull requests com revisão.
- [ ] Desempenho (Performance Advisor, 02/10/2026; nada urgente com o volume atual): ~56 FKs sem índice de cobertura (principalmente as compostas e `criado_por`/`atualizado_por`) e ~26 casos de várias policies permissivas para o mesmo papel e ação. Criar índices nas FKs mais usadas e consolidar policies numa migration quando o portal e o painel estiverem consultando de verdade.
- [ ] Segurança (aviso aceito, ver doc 03 > Permissões): mover `is_plataforma()`/`tem_papel()` para um schema não exposto na Data API.
- [ ] Conferir os nomes das 18 seções padrão da Central (`provisionar_municipio`) com as dimensões da matriz PNTP 2026 (D-35) e ligar cada critério ao item da Central que o atende (`pntp_atendimento.transparencia_item_id`, hoje não usado pela tela).
- [ ] Revisar os textos-guia das 6 páginas padrão do provisionamento (hoje é uma frase cada) e decidir se a SECKE oferece um modelo completo (ex.: política de privacidade).
- [ ] Prioridade baixa do doc 08: Diário Oficial próprio, câmaras como cliente (`municipios.tipo`), `config.fuso_horario`, ampliar `sistemas_externos.categoria`.
- [ ] Criação de usuários pelo admin do município: Edge Function com service_role (convite por e-mail) + linha em `membros`.

## Perguntas para a reunião inicial com o Município
Tudo o que precisa ser levantado com a prefeitura está organizado em **[docs/reuniao/](reuniao/00-LEIA-PRIMEIRO.md)**: guia e pauta (00), acessos e domínio (01), migração (02), transparência e sistemas (03), dados e conteúdo institucional (04), identidade visual (05), usuários, suporte e contrato (06). **Ao incluir uma nova pergunta para a prefeitura, colocar lá**, no arquivo do assunto.

## Concluído
- 04/10/2026: **imagens otimizadas** (D-36): página inicial de 4,9 MB para 249 KB de imagens, lista de notícias de 6,9 MB para 410 KB. Acompanhar o uso da cota de transformações (Cloudflare → Images) quando houver mais prefeituras.
- 04/10/2026: **kit da reunião**: roteiro de demonstração (`docs/reuniao/07`) e guia de teste da homologação para a prefeitura (`docs/reuniao/08`).
- 04/10/2026: **PNTP 2026** (D-35): matriz oficial (181 critérios, 96 de prefeitura) na produção e na homologação, tela de acompanhamento no painel, critérios 13.1, 13.4, 13.5 e 2.9 atendidos pelo portal; auditoria de acessibilidade 69 páginas, 0 problemas.
- 04/10/2026: **backup da homologação no R2** funcionando: restauração conferida com todo o conteúdo migrado (683 notícias, 956 documentos, 6.905 mídias, 7.497 redirecionamentos, 20.294 registros de auditoria, 8 usuários). Produção e homologação verdes.
- 04/10/2026: **backup extra da produção no R2** (D-34): R2 ativado pelo usuário, bucket `portal-municipal-backups` (enam) com expiração de 30 dias, token só de objetos nesse bucket, segredos no GitHub; execução manual verde com restauração conferida. Um token do R2 cujo segredo apareceu num print foi substituído por outro e apagado pelo usuário.
- 04/10/2026: **auditoria automática de acessibilidade** (D-33): 67 páginas do portal e do painel, 0 problemas. 0014 aplicada pelo usuário; nova verificação de links: 217 problemas, 217 registros (sem duplicar).
- 04/10/2026: **verificação de links (RF18) e exportação completa (RF19)** na homologação (D-31, D-32): 0012 e 0013 aplicadas pelo usuário no SQL Editor; Edge Functions `verificar-links` e `exportar`; telas no painel; ambas testadas de ponta a ponta com os dados de Jeriquara.
- 03/10/2026: **cache na borda por município com limpeza ao publicar** (D-30): `portal/src/worker.ts`, cabeçalhos no middleware, migration 0011 na homologação, 71 testes de permissão. Vault da homologação cadastrado pelo usuário; teste ponta a ponta: gravação às 20:57:15, limpeza às 20:58:00 (200), página nova às 20:58:05. Falta a produção.
- 03/10/2026: descrição (alt) das imagens dentro do texto: 371 textos migrados corrigidos (`migracao/corrigir-alt.mjs`); a migração já preenche nas próximas prefeituras (`migracao/alt.mjs`).
- 03/10/2026: conferido que o portal já respeita `config.modulos` (rotas, menus, sitemap), `publicacoes.expira_em` e `destaques.fim_em`. O painel mantém as telas de módulos desligados de propósito: a prefeitura pode preparar o conteúdo antes de ligar.
- 02/10/2026: análise de requisitos e viabilidade (doc 01).
- 02/10/2026: inventário do site atual (doc 05, planilha e JSON).
- 02/10/2026: schema multi-prefeitura 0001–0006 + seed + 23 testes de RLS.
- 02/10/2026: análise de capacidade multi-prefeitura (doc 04).
- 02/10/2026: documentação, CLAUDE.md e registro de decisões.
- 02/10/2026: revisão do schema como base genérica (doc 08). Corrigidos isolamento entre municípios (D-11), brechas da D-09 em arquivos e Storage, `atualizado_por`, auditoria de `municipios`, limite 120 fixo e `(select auth.uid())`. Testes: 23 → 34.
- 03/10/2026: **migração completa de notícias e documentos de Jeriquara na homologação** (D-28): 683 notícias, 956 documentos, 6.860 arquivos (7,2 GB), 7.347 redirecionamentos, galerias montadas, 0 órfãs, 0 erros. Pendentes: 445 arquivos que não existem no site atual e 12 acima de 50 MB (listas em `migracao/relatorios/`, itens 2.7 e 2.8 da reunião).
- 03/10/2026: homologação limpa: 83 itens de teste ("E2E") e de exemplo apagados (mantidos os 5 órgãos de exemplo); notícias fictícias apagadas pelo usuário. `npm run e2e` agora limpa o que os testes criam ao final (`painel/e2e/rodar.mjs`).
- 03/10/2026: login da homologação configurado pelo usuário (Site URL = painel publicado; Redirect URLs: painel publicado e localhost:5190 `/redefinir-senha`).
- 03/10/2026: homologação publicada na Cloudflare (D-27): portal https://portal-municipal-homologacao.portal-municipal.workers.dev e painel https://painel-municipal-homologacao.portal-municipal.workers.dev.
- 03/10/2026: código no GitHub, repositório privado `willquerubim2025-oss/portal-municipal` (D-25), sem `.env`, chaves nem o arquivo local de senhas.
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
