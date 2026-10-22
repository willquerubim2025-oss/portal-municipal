# Registro de decisões

Formato: **D-xx · data · decisão** → motivo → alternativas descartadas. Decisão revogada não se apaga: marcar como *Substituída por D-yy*.

---

**D-01 · 02/10/2026 · Portal público em Astro SSR no Cloudflare Pages; painel em React + Vite**
- Motivo: um site de prefeitura precisa de SEO, HTML semântico (WCAG/eMAG), 301 reais e carregamento rápido no celular, e uma SPA atrapalha em tudo isso. O painel não precisa de SEO e aproveita a experiência do GeoEscolas.
- Descartado: SPA única em React (problemas acima); WordPress (manter um CMS de terceiros contraria o objetivo de produto próprio).

**D-02 · 02/10/2026 · Supabase em projeto novo, região sa-east-1, plano Pro**
- Motivo: LGPD (dados no Brasil), latência, backup diário e projeto que não pausa. Não misturar com GEOESCOLAS, SigDoc ou SIGACO.
- Descartado: reaproveitar o projeto GEOESCOLAS (us-west-2, outro produto); plano grátis (sem backup e pausa por inatividade).

**D-03 · 02/10/2026 · Produto multi-prefeitura com banco compartilhado (`municipio_id` + RLS)**
- Motivo: R$ 4.000 de implantação não pagam um CMS feito para um cliente só; como produto, do segundo município em diante o custo é quase só a migração. A capacidade é suficiente (ver doc 04).
- Descartado: um banco por prefeitura desde o início (custo e manutenção multiplicados). Continua possível para um cliente que exigir isolamento.

**D-04 · 02/10/2026 · Licitações são `documentos` (categoria + `metadados jsonb`), sem tabela própria**
- Motivo: no site atual, licitações, portarias e decretos são posts por categoria; prefeituras diferentes têm formatos diferentes; vários arquivos por documento já são suportados por `documento_arquivos`.
- Reavaliar se surgir uma exigência de filtros estruturados (modalidade, situação) que o `jsonb` com índice não resolva bem.

**D-05 · 02/10/2026 · Backup: Supabase Pro (7 dias) + `pg_dump` diário em GitHub Action para o Cloudflare R2 (30 dias) + export diário por município**
- Motivo: o RNF05 sugere 30 dias de retenção; o export por município permite restaurar um cliente sem afetar os outros.

**D-06 · 02/10/2026 · O consumo de solicitações editoriais é lançado pela SECKE ao concluir o chamado (`chamados.solicitacoes_consumidas`)**
- Motivo: a regra de contagem de uma "solicitação editorial" ainda não está definida (pergunta para a reunião inicial). O lançamento manual permite qualquer regra. O município vê o saldo, mas não altera.

**D-07 · 02/10/2026 · Integração com Fiorilli, FlowDocs e afins apenas por link (`sistemas_externos`)**
- Motivo: o TR proíbe replicar dados; os sistemas ficam em portas próprias, sem API conhecida. Confirmar na reunião inicial se existe API.

**D-08 · 02/10/2026 · Inventário do site atual pela API REST do WordPress, não por crawler**
- Motivo: o `robots.txt` bloqueia robôs genéricos, e a API é pública, estruturada e exige ~100 requisições em vez de milhares.

**D-09 · 02/10/2026 · Editor não altera nem despublica conteúdo publicado (trigger `checar_permissao_publicacao`)**
- Motivo: a policy de UPDATE não enxerga o status antigo; sem o trigger, o editor conseguiria tirar conteúdo do ar.

**D-10 · 02/10/2026 · Norte do projeto: construir uma base para prefeituras em geral, não apenas o site de Jeriquara**
- Decisão do usuário: o banco, a lógica de funcionamento, o painel e o portal devem nascer genéricos e prontos para atender a maior parte das prefeituras brasileiras. Jeriquara é o primeiro cliente e serve para validar a base, não para defini-la.
- Na prática:
  - tudo o que for específico de um município (textos, cores, menus, categorias, seções da Central de Transparência, sistemas externos, regras de contrato) é **dado ou configuração**, nunca código;
  - um requisito pedido só por Jeriquara é implementado de forma genérica e configurável, ou ligado/desligado por município em `municipios.config`;
  - o padrão segue a legislação comum a todas as prefeituras (LAI, Lei 13.460, LGPD, PNTP/Atricon, eMAG/WCAG), e não só o Termo de Referência de Jeriquara;
  - incluir um município novo deve exigir só cadastro, seed e migração de conteúdo, sem mudança no schema nem no código.
- Motivo: é o que viabiliza o produto (D-03); o valor de implantação de um cliente só não paga um sistema feito sob medida.
- Reforça D-03. Na dúvida entre a solução mais rápida para Jeriquara e a mais genérica, preferir a genérica, salvo se o prazo de 60 dias estiver em risco. Nesse caso, registrar o atalho como pendência.

**D-11 · 02/10/2026 · Integridade entre municípios garantida pelo banco (FKs compostas), não só pelo RLS**
- Toda referência entre tabelas com `municipio_id` usa FK composta `(id, municipio_id)`. As tabelas filhas sem a coluna (`publicacao_categorias`, `documento_arquivos`) conferem o município na policy.
- Motivo: o RLS controla quem escreve, mas não impedia o admin de A de apontar para um registro de B (item de menu no menu de B, chamado contra o contrato de B). Com FK composta, a combinação errada nem existe.
- Junto: destino de item da Central de Transparência usa `on delete restrict` (não some da Central sem aviso), e substituir arquivo no Storage ou mexer nos arquivos de documento publicado exige publicador ou admin (completa a D-09). Detalhes em doc 08.

**D-12 · 02/10/2026 · Módulos genéricos de prioridade alta e média entram antes de aplicar o banco (migration 0007)**
- Decisão do usuário, a partir da lista do doc 08.
  - Alta: estrutura organizacional (`orgaos`), perguntas frequentes e provisionamento de município (`criar_municipio` / `provisionar_municipio`).
  - Média: legislação com vigência (`documentos.situacao` + `documento_relacoes`), destaques (banners e alertas), galeria (`publicacao_midias`), agenda e eventos, `expira_em` em publicações e módulos ligáveis em `municipios.config.modulos`.
- Motivo: a LAI e o PNTP cobram de todo município a estrutura organizacional e as perguntas frequentes, e os demais aparecem em quase todo portal municipal. Incluir antes de aplicar evita migrations de correção depois; o provisionamento torna real a regra da D-10 de que "município novo = só cadastro".
- Como foi feito:
  - concursos e processos seletivos **não** ganharam tabela: são categorias de `documentos` (coerente com D-04);
  - `servicos.orgao_responsavel` (texto) foi trocado por `orgao_id`;
  - a estrutura organizacional é gerenciada pelo admin, como menus e a Central, e o resto segue o fluxo editorial (D-09);
  - as páginas padrão nascem em rascunho para a prefeitura revisar.
- Ficou para depois (doc 08, prioridade baixa): Diário Oficial próprio, câmaras municipais como cliente, fuso horário por município, ampliar `sistemas_externos.categoria`.

**D-13 · 02/10/2026 · Projeto Supabase sem exposição automática de tabelas; permissões explícitas por migration**
- Projeto *Portal Municipal* (`qgywucdnaeheqndcxtho`), criado pelo usuário no painel porque a ferramenta de criação foi bloqueada pelas permissões do Claude Code. Opções: Data API ligada, *Automatically expose new tables* **desligado**, *automatic RLS* **ligado**.
- Motivo: num banco com dados de várias prefeituras, o RLS não deve ser a única barreira. Com GRANTs explícitos (migrations 0008 e 0009), o visitante só tem SELECT nas tabelas do portal, TRUNCATE não existe para ninguém e esquecer um grant faz a funcionalidade **falhar fechada**, em vez de expor dados. Recomendação do próprio Supabase.
- Consequência: toda tabela ou função nova precisa de GRANT explícito (anon, authenticated e service_role), e o teste local passou a não conceder nada por conta própria.
- Descartado: deixar a exposição automática (mais simples, mas toda tabela nova nasceria com todas as operações liberadas para anon).

**D-14 · 02/10/2026 · Homologação em uma branch do Supabase (`homologacao`), não em um segundo projeto**
- Decisão do usuário. A branch é recriada a partir das migrations do projeto *Portal Municipal* e não leva os dados de produção: o seed (e, depois, a carga de teste da migração do WordPress) é aplicado nela à parte.
- Usos: testar migrations novas antes de produção, ensaiar a migração do WordPress quantas vezes for preciso, a prefeitura aprovar o site antes da troca de domínio, treinar usuários.
- Motivo: é cobrada por hora (~US$ 0,01344/h, ~US$ 10/mês se ficar ligada direto) e pode ser apagada entre os ciclos de teste. Um segundo projeto custaria o mês inteiro e duplicaria a configuração.
- A criação pela ferramenta do MCP foi bloqueada pelas permissões do Claude Code (como a do projeto); o usuário cria pelo painel.

**D-15 · 03/10/2026 · SEO tratado na base do portal, igual para todos os municípios (checklist no doc 09)**
- Motivo: a pergunta do usuário sobre indexação no Google. A arquitetura já resolve o principal (SSR, 301 reais, URLs limpas, HTML semântico, cache na borda). O resto vira padrão do portal, não trabalho por cliente (D-10): sitemap e robots dinâmicos por domínio, domínio canônico único (`municipio_dominios.principal`, os outros com 301), **homologação sempre com `noindex`**, título/descrição/Open Graph por página, dados estruturados schema.org (GovernmentOrganization, NewsArticle, Event, FAQPage, GovernmentService, Legislation, BreadcrumbList), imagens otimizadas para Core Web Vitals e Search Console por município.
- Impacto no banco: pequeno (`midias.largura`/`altura` numa migration futura; chaves de SEO em `municipios.config`).

**D-16 · 03/10/2026 · Portal público: Astro 7 em Cloudflare Workers (não Pages) e padrões de implementação**
- **Workers em vez de Pages:** o adaptador atual (`@astrojs/cloudflare` 14) publica no Cloudflare Workers com *static assets*, que é o caminho recomendado hoje pela Cloudflare. Muda só o produto de hospedagem da D-01; SSR, cache na borda e 301 reais continuam iguais.
- **Desenvolvimento lê a branch de homologação** (D-14), com conteúdo de exemplo marcado `legado = {"exemplo": true}` (em `destaques`, que não tem `legado`, o exemplo é o alerta "Campanha de vacinação").
- **HTML do editor é sanitizado na renderização** (`xss`, lista branca; iframe só YouTube/Vimeo). Motivo: um usuário do painel pode colar `<script>`; sanitizar na saída protege também o conteúdo migrado do WordPress.
- **Fontes do sistema**, sem Google Fonts: desempenho e LGPD (não envia o IP do visitante a terceiros).
- **Menu padrão automático** a partir dos módulos ligados quando o município não cadastrou o menu `principal`; **atalhos padrão** na home quando não há menu `atalhos`. Município novo já sai navegável (D-10).
- **Seções vazias da Central de Transparência não aparecem** (ficam ocultas até ganharem um item).
- **Legislação** = documentos das categorias em `config.legislacao_categorias` (padrão: as do provisionamento).
- `trailingSlash: 'ignore'` no Astro + 301 no middleware (com `'never'` o Astro respondia 404 antes do middleware).

**D-17 · 03/10/2026 · Personalização visual em três níveis; nunca um código por prefeitura**
- Pergunta do usuário: as prefeituras poderão caracterizar as páginas? Sim, em níveis:
  1. **Configuração pelo painel** (já suportado): cores, brasão, logo, dados do rodapé, menus, atalhos, banners e alertas, módulos ligados, páginas e Central de Transparência.
  2. **Tema ampliado com opções prontas** (a implementar): home montada por blocos escolhidos e ordenados (`config.home.blocos`), variações de cabeçalho, estilo de cartões e cantos, fontes auto-hospedadas. Tudo em `tema`/`config`.
  3. **Código só para recurso novo**, que entra como opção para todos os municípios.
- **Proibido:** fork ou ramificação do código por prefeitura (com N clientes seriam N sistemas para manter).
- **Não personalizável** (obrigação legal): contraste mínimo WCAG (o painel valida as cores), barra de acessibilidade eMAG e links obrigatórios do rodapé (Acesso à Informação, Ouvidoria, Transparência).

**D-18 · 03/10/2026 · Painel: padrões do GeoEscolas, Notícias como molde e regras de edição**
- **Stack:** React 19, Vite 8, react-router-dom 7, supabase-js, TipTap 3 (editor), TypeScript 6 (o 7 é a reescrita nova; evitar até amadurecer). Pasta `painel/`.
- **Padrões do GeoEscolas:** `AuthContext` como fonte única de sessão, prefeituras e papel; `ExigirAcesso` como único guarda de rotas. Usuário autenticado sem vínculo ativo = sem acesso (nunca admin por omissão).
- **Multi-prefeitura no painel:** a SECKE vê todos os municípios como admin; quem tem mais de um vínculo escolhe a prefeitura (lembrada no navegador).
- **Editor de texto restrito** por acessibilidade: só H2/H3, imagem com texto alternativo obrigatório, sem cores e fontes livres.
- **Slug travado depois de publicado** (não quebra links nem o Google); antes disso, gerado do título.
- **Publicação:** editor salva rascunho; publicador/admin publica, agenda (`publicado_em` futuro), despublica e exclui. A tela só esconde o que não pode; quem garante é o banco (D-09).
- **"Sair" explícito não lembra a página anterior** (descoberto no teste: o próximo usuário caía na página do anterior); sessão expirada lembra.
- **Usuários de teste só na homologação** (`admin.teste@` / `editor.teste@exemplo.gov.br`), criados por SQL direto no `auth.users` da branch.

**D-19 · 03/10/2026 · Painel fase 2: lógica de edição comum (`useEdicao`) e padrões de acessibilidade dos formulários**
- Toda tela de conteúdo publicável usa o mesmo gancho (`useEdicao`) e os mesmos componentes (cabeçalho, barra de ações, lista genérica). Motivo: as regras de publicação (D-09) ficam num lugar só, e uma correção vale para todos os módulos. Notícias foi reescrita sobre ele e os testes continuaram 19/19.
- Validação em duas camadas: a tela valida antes de enviar (mensagem clara) e o banco continua sendo a garantia (CHECK, RLS, trigger). Erro de CHECK do banco vira mensagem em português (`23514`).
- **Texto de ajuda fora do `<label>`:** descoberto pelo teste. Dentro do rótulo, o leitor de tela anunciava "Endereço no site Gerado a partir do título..." como nome do campo.
- Documentos: campos extras por tipo em `metadados` com sugestões (licitações: modalidade, processo, situação, abertura...), arquivos por upload ou link externo com ordem, e relações entre atos com busca.
- Páginas: endereço montado da página-mãe + trecho; mãe e trecho travam depois de publicado; a página não pode ser mãe de si mesma nem de uma ancestral.

**D-20 · 03/10/2026 · Painel fase 3 (estrutura) e trava dos dados oficiais do município**
- **Admin do município só altera `tema` e `config`** (migration 0010, trigger `checar_campos_municipio`). Nome oficial, slug, UF, CNPJ e `ativo` (tirar o portal do ar) são só da SECKE. Motivo: a policy "admin edita o seu" (0005) liberava a linha inteira; descoberto ao construir a tela de identidade. Aplicada na homologação e depois na produção (D-14).
- **Cadastros de estrutura não têm rascunho:** órgãos, menus, Central de Transparência, sistemas externos, categorias e redirecionamentos valem ao salvar. Só o admin mexe neles; categorias também o publicador.
- **Identidade visual valida contraste WCAG AA** (4,5:1) da cor principal com texto branco e da cor de destaque com texto escuro, com prévia do cabeçalho (D-17).
- **Menus:** dois níveis (item e subitem); destino página, categoria, endereço ou só agrupador; menu principal vazio oferece "Começar com o menu padrão".
- **Categoria renomeada mantém o endereço (slug)**, para não quebrar links já compartilhados.
- **Redirecionamento:** a origem é normalizada (sem domínio, minúscula, com "/"); no portal, URL com barra final consulta os redirecionamentos **antes** de tirar a barra (antes eram dois 301 seguidos para URLs do WordPress).
- **Mensagem de sucesso ao criar** (rota `/novo` → `/:id`) é levada no estado da navegação; antes sumia.

**D-21 · 03/10/2026 · Usuários por Edge Function, chamados com saldo e auditoria legível (painel fase 4)**
- **Convite pela Edge Function `convidar-usuario`** (código em `supabase/functions/`, publicada na homologação e na produção). A chave de serviço só cria a conta no Auth e grava o perfil (nome/e-mail, sem poder). O **vínculo com o papel (`membros`) é gravado com o token de quem convida**: o RLS confere que ele é admin daquele município e a auditoria registra o autor.
- **E-mail do convite:** tenta o envio do Supabase; sem SMTP próprio (o padrão do Supabase só envia para a equipe da organização e tem limite baixo), a função devolve o **link de convite** para o admin repassar. O link leva a `/redefinir-senha`, onde o convidado cria a senha (mínimo de 10 caracteres).
- **Usuário que já atende outra prefeitura** só ganha o novo vínculo; o nome dele não é sobrescrito.
- **Desativar acesso** = `membros.ativo = false` (a conta e o histórico continuam). O admin não altera o próprio acesso.
- **Chamados:** o município abre e conversa; a SECKE muda situação, prioridade e lança o consumo (D-06), e pode escrever nota interna invisível à prefeitura. Saldo do contrato com barra de consumo e relatório mensal para o fiscal na própria tela.
- **Auditoria:** leitura para o admin, com autor, ação, item ("acesso de Fulano (papel)") e tabela "o que mudou" campo a campo. Sem usuário = rotina automática; autor sem perfil visível = equipe SECKE.
- Descobertos no teste: `membros` e `perfis` não têm FK entre si (duas consultas); o perfil do convidado não podia ser gravado com o token do admin (o RLS de `perfis` só mostra colegas), por isso o perfil é gravado pelo servidor depois do vínculo.

**D-22 · 03/10/2026 · Migração do WordPress começa já, independente da definição visual**
- Pergunta do usuário: é preciso ter layout, cores e seções definidos antes de migrar? **Não.** Conteúdo (banco, campos neutros) é separado da apresentação (`tema`/`config` + tema do portal, D-17); o visual pode mudar depois sem tocar no conteúdo migrado.
- **Script repetível e idempotente:** cada item guarda `legado.wp_id`/`legado.url`; rodar de novo atualiza em vez de duplicar. Ciclo: rodar na homologação → ajustar mapa de categorias e coluna Destino com a prefeitura → rodar de novo → rodada final incremental na véspera da troca do domínio.
- **Começa com propostas da SECKE** para o mapa de categorias e a classificação sugerida do inventário; a validação do Município (RM05) refina nas rodadas seguintes.
- **HTML limpo na migração:** remove a marcação do Elementor/estilos inline e guarda só conteúdo semântico (parágrafos, títulos H2/H3, listas, tabelas, links, imagens), para servir a qualquer tema futuro; reescreve os links internos para PDF (~3.650) para o Storage.
- Vantagem: a prefeitura define o visual vendo o próprio conteúdo real na homologação.

**D-23 · 03/10/2026 · Ferramenta de migração genérica (motor + mapa por prefeitura) e regras de Jeriquara**
- Pasta `migracao/`: motor genérico (`classificar.mjs`, `migrar.mjs`, `simular.mjs`, `limpar-orfas.mjs`) e **mapa por prefeitura** em JSON (`mapas/jeriquara.json`). Prefeitura nova = novo mapa (D-10).
- **Classificação** (ordem): categoria de arquivo → modalidade de licitação → categoria de documento direta → categoria genérica decidida pelo título → notícia (tema pela categoria ou pelo prefixo do título).
- **Jeriquara:** 475 notícias, 956 documentos (829 licitações com a modalidade em `metadados`), 208 boletins da Covid como notícias "em arquivo" (`expira_em` logo após a publicação: fora das listagens, link mantido). Categorias duplicadas unificadas. Todos os "Boletim…" de 2020–2022 tratados como Covid (a confirmar). A proposta para a prefeitura validar está em `docs/reuniao/02-migracao-do-site-atual.md` (antes doc 10).
- **Arquivos:** endereço normalizado e caminho determinístico no Storage, para não enviar duas vezes; anexos não-imagem viram `documento_arquivos`; a primeira imagem do post vira a de destaque.
- **Texto alternativo:** o WordPress não tinha. A migração usa o título da mídia ou "Imagem: <título do post>" e marca `legado.alt_automatico` para revisão.
- **Execução como usuário real** (SECKE ou admin), pelo RLS e com auditoria; não usa chave de serviço.
- Amostra na homologação (50 + 50): 0 erros de gravação; repetição sem duplicar; redirecionamentos de post e de arquivo conferidos no portal (um salto, inclusive com as maiúsculas do endereço antigo).

**D-24 · 03/10/2026 · Material da reunião com a prefeitura numa pasta única (`docs/reuniao/`)**
- Pedido do usuário: tudo o que precisa ser levado à reunião num só lugar, deixando claro **que informação levantar, onde ela será usada e o que muda no sistema conforme a decisão**.
- Estrutura: `00-LEIA-PRIMEIRO` (pauta, checklist com prioridade B/I/D, registro de datas de entrega) e um arquivo por assunto (01 acessos e domínio, 02 migração, 03 transparência e sistemas, 04 dados e conteúdo institucional, 05 identidade visual, 06 usuários, suporte e contrato). Cada item segue o mesmo formato: o que precisamos / quem costuma saber / onde será usado / o que muda conforme a resposta / bloqueia? / espaço para a resposta.
- O antigo doc 10 (mapa da migração) foi incorporado ao `reuniao/02`. A seção de perguntas do doc 07 passou a apontar para a pasta.
- Destaque contratual levado ao guia: os 60 dias de implantação contam da entrega dos acessos e materiais pelo Município (TR 6.9.2); a reunião deve terminar com datas de entrega registradas.
- Regra daqui em diante: pergunta nova para a prefeitura entra no arquivo do assunto em `docs/reuniao/`.

**D-25 · 03/10/2026 · Código no GitHub, repositório privado `portal-municipal`**
- Repositório: https://github.com/willquerubim2025-oss/portal-municipal (**privado**, branch `main`). Um repositório só para o produto (supabase, portal, painel, migracao, docs), com nome genérico (D-10).
- Nunca versionar: `.env` (só `.env.example`), `node_modules`, builds, relatórios da migração, prints dos testes e **arquivos de anotação com senhas** (`senhas*.txt`). Há um arquivo `senhas de teste.txt` local do usuário, mantido fora do git.
- Fim de linha LF para todos os arquivos (`.gitattributes`), para não gerar diferenças falsas no Windows.
- Motivo: até aqui o projeto existia só numa pasta local (risco de perda) e o GitHub é pré-requisito do backup `pg_dump` → R2 por GitHub Action (D-05) e da publicação automática.
- A avaliar: transferir o repositório para uma organização da SECKE no GitHub quando houver mais pessoas na equipe.

**D-26 · 03/10/2026 · Manter o teto de gastos do Supabase; arquivos acima de 50 MB tratados à parte (adiado, com lembrete)**
- Decisão do usuário (opção B): o *spend cap* continua **ligado**, então o upload fica limitado a 50 MB. Sem risco de cobrança acima do plano Pro no início.
- **Não interfere na migração:** arquivo acima do limite é pulado e anotado; o resto do post migra. Rodar a migração de novo depois de resolver o limite envia só os que faltaram e os anexa ao documento (a ferramenta é repetível).
- A migração gera `migracao/relatorios/arquivos-grandes-<municipio>.csv` e mostra um aviso ao final de cada rodada.
- **Lembrete:** item no topo de `docs/11-checklist-ir-ao-ar.md` ("Não esquecer"). Resolver antes da migração final: a prefeitura comprime e reenvia os arquivos da lista **ou** desligar o teto com alerta de gasto.

**D-27 · 03/10/2026 · Homologação publicada na Cloudflare (conta da SECKE) e variáveis por ambiente**
- Conta Cloudflare **`comercial@seckesistemas.com`** (da empresa), subdomínio `portal-municipal.workers.dev`. Login do Wrangler por OAuth nesta máquina.
- **Portal:** Worker `portal-municipal-homologacao` → https://portal-municipal-homologacao.portal-municipal.workers.dev (cadastrado em `municipio_dominios` da homologação como principal; `noindex` automático). Produção será o Worker `portal-municipal`.
- **Painel:** Worker só de arquivos (SPA) `painel-municipal-homologacao` → https://painel-municipal-homologacao.portal-municipal.workers.dev. Produção: `painel-municipal`.
- **Portal lê o banco em tempo de execução:** as variáveis do Astro passaram a `access: 'secret'` (antes `public`, que **embutia** a URL do banco no build). O mesmo build serve aos dois ambientes; cada Worker tem as suas `vars` em `portal/wrangler.jsonc` (produção no topo, `env.homologacao`). Evita publicar na produção um build apontado para a homologação.
- **Painel (SPA) precisa de build por ambiente** (o navegador recebe as variáveis): `npm run deploy:homologacao` / `deploy:producao`, com `painel/.env.homologacao` e `.env.producao` **versionados** (só chaves publicáveis). `VITE_AMBIENTE` faz o "Ver o site" apontar para o portal do mesmo ambiente.
- O adaptador do Astro criou um KV `portal-municipal-homologacao-session` (sessões, não usado; gratuito).
- Testes no publicado: todas as rotas 200, 404 real, `noindex` + `robots` bloqueando, 301 de notícia e de PDF antigos num salto, login no painel e retorno à página pedida. Tempo de resposta 0,8–2 s sem cache na borda (pendência).

**D-28 · 03/10/2026 · Migração completa de Jeriquara na homologação: resultados e correções**
- **Resultado (1ª rodada, 112 min):** 683 notícias (475 + 208 boletins em arquivo) e 956 documentos, iguais à simulação; 6.034 arquivos enviados; 7.673 redirecionamentos; **0 erros de gravação**.
- **445 arquivos ausentes no próprio site atual** (404 até pelo endereço que o WordPress informa), em **173 documentos e notícias**, quase todos de 2018–2022 (provável perda em troca de servidor). Não é falha da migração: a codificação foi testada com arquivos que existem. Lista para a prefeitura procurar em backup: `migracao/relatorios/arquivos-ausentes-no-site-atual-jeriquara.csv`. Pergunta incluída em `docs/reuniao/02` (item 2.7).
- **12 arquivos acima de 50 MB** não migraram (D-26); lista em `migracao/relatorios/arquivos-grandes-jeriquara.csv`. 6 falhas de rede temporárias, que passam numa nova rodada.
- **Corrigido: fotos de galeria das notícias.** A 1ª rodada só usava a primeira imagem como destaque; as demais fotos anexadas e não citadas no texto ficavam sem lugar (~305). Agora vão para a **galeria** (`publicacao_midias`); PDFs anexados a notícias e não citados viram uma lista "Arquivos" no fim do texto; nos documentos, todo anexo não citado (inclusive imagem escaneada) vira `documento_arquivos`. **2ª rodada (21 min):** 246 fotos foram para as galerias, os 6 arquivos com falha de rede entraram, 6.855 reaproveitados sem novo download; falhas restantes só as esperadas (12 grandes + 445 ausentes); **0 mídias órfãs** (todos os 6.860 arquivos, 7,2 GB, estão em uso). Conferido no portal publicado: galeria, anexos e 10 de 10 endereços antigos sorteados com 301.
- **Corrigido: a limpeza de órfãs quase apagou anexos de licitações.** A consulta de `documento_arquivos` não paginava, e o PostgREST devolve no máximo 1.000 linhas: anexos além do milésimo pareciam "sem uso" (1.486 falsas órfãs, contra 305 reais). Agora pagina. **Regra:** toda consulta que pode passar de 1.000 linhas precisa paginar com `range()`.

**D-29 · 03/10/2026 · Páginas do WordPress migradas antes da reunião**
- **Decisão:** migrar já as páginas, sem esperar a reunião (item 2.4), para adiantar. A homologação não aparece no Google, e tudo pode ser refeito pelo mapa.
- **Como:** das 129 páginas, só **12 têm conteúdo próprio**; o resto é duplicada ("-2", "-3"), página vazia de menu ou link para sistema externo. Migradas e **publicadas**: Gabinete da Prefeita e da Vice-Prefeita (em `a-prefeitura/`), 7 departamentos (em `departamentos/`, com a PNAB dentro de Cultura), duas versões da História (em `o-municipio/`) e Fale Conosco. De cada duplicada fica a versão mais completa (em empate, a editada por último). `a-prefeitura` e `departamentos` são páginas novas que agrupam as migradas.
- **Endereços antigos:** os 129 têm destino. Duplicadas vão para a página mantida; páginas de assunto vão para a parte nova do portal (licitações, decretos e portarias para `/documentos?categoria=…`, transparência para `/transparencia`, leis para `/legislacao`); links de sistema vão direto ao sistema (SIS-Web, SCPI, FlowDocs, NFS-e nacional). Quem não tem regra vai para a página inicial; hoje só `/webmail/`.
- **Genérico:** etapa `--paginas` do `migrar.mjs`, guiada pela seção `paginas` do mapa (`pais`, `migrar`, `redirecionar`, `mesmo_endereco`, `padrao`). A seção `dados_institucionais` preenche `municipios.config`, mas só nos campos vazios ou de exemplo, para não apagar correções feitas no painel.
- **Resultado na homologação:** 12 páginas, 33 imagens, 153 redirecionamentos, 0 erros. CNPJ, endereço, telefone, e-mail e horário da página Fale Conosco foram para o rodapé (a confirmar no item 4.1).
- **Corrigido no portal:** a descrição para o Google, gerada do texto da página, mostrava entidades do HTML (`&amp;#8211;` em vez de "–"). `resumir()` agora decodifica as entidades.

**D-30 · 03/10/2026 · Cache na borda por município, com limpeza ao publicar**
- **Decisão:** usar o cache de Workers da Cloudflare (`"cache": {"enabled": true}` no `wrangler.jsonc`). Uma visita servida pelo cache não roda o Worker nem consulta o banco. Isso protege o limite de 10 ms de CPU e o de 100 mil acessos/dia do plano grátis, e a carga do Supabase.
- **Cuidado que define o desenho:** esse cache guarda pelo **caminho**, não pelo domínio. Ligado do jeito padrão, `/noticias` de uma prefeitura apareceria no site de outra. Por isso o Worker tem duas entradas (`portal/src/worker.ts`): a portaria (`default`, sem cache) repassa ao `Portal` (com cache), com o domínio em `ctx.props`, que entra na chave do cache.
- **Validade:** 10 min para páginas (200), redirecionamentos (301) e 410; 2 min para 404. O navegador continua com 60 s. A busca não é guardada. Os 10 min são a rede de segurança se uma limpeza falhar e o atraso máximo do que tem data marcada (`publicado_em`, `expira_em`).
- **Limpeza ao publicar (migration 0011):** gatilhos em 22 tabelas marcam o município em `interno.cache_pendente`; a cada minuto, `pg_cron` envia uma única chamada (`pg_net`) com as etiquetas `m-<municipio_id>` de todos os pendentes para `POST /__cache/limpar`, protegido pelo segredo `CACHE_SEGREDO` (Worker) = `portal_cache_segredo` (Vault). Agrupar por minuto respeita o limite da Cloudflare (5 limpezas/min, 100 etiquetas cada), mesmo durante uma migração. O contador de acessos dos redirecionamentos não dispara limpeza.
- **Schema `interno`:** primeiro uso de um schema não exposto pela Data API; a fila e as funções ficam fora do alcance de anon e authenticated. É o caminho também para `is_plataforma()`/`tem_papel()` (pendência).
- **Testado na homologação:** 2ª visita em diante = HIT; limpeza com segredo funciona (próxima visita = MISS); sem segredo = 401. A cada deploy o cache começa vazio (a versão do Worker faz parte da chave).
- **Alternativas descartadas:** Cache API (`caches.default`) não funciona em `workers.dev` e só limpa por data center; Cache Rules da zona exigem zona própria e não cobrem os domínios das prefeituras.

**D-31 · 03/10/2026 · Verificação de links quebrados (RF18)**
- **Como funciona:** toda semana (domingo, 3h de Brasília) cada município ativo ganha uma verificação pendente; o publicador também pode pedir pelo painel (Administração → Links quebrados). A Edge Function `verificar-links` confere em lotes (8 em paralelo, 10 s por link, HEAD e, se recusado, GET de 1 byte), para em ~110 s e continua na chamada seguinte. Problemas aparecem no painel com o link para editar o item.
- **O que entra:** links e imagens do conteúdo **publicado** (notícias, documentos e anexos externos, páginas, serviços, agenda, perguntas, órgãos, banners vigentes, menus, transparência, sistemas). Links para arquivos do próprio Storage são conferidos **no banco** (`storage.objects`), sem requisição: são milhares.
- **O que é problema:** 404/410 ("não encontrado"), erro 5xx, sem resposta, DNS ou certificado inválido ("indisponível"). 401/403/429 são bloqueio a robôs e **não** contam.
- **Disparo sem segredo:** o `pg_cron` chama a função a cada minuto **só se há trabalho na fila**. A função não recebe parâmetros e só processa o que está na fila; por isso usa `verify_jwt = false` sem segredo: chamá-la de fora só adianta o que já foi pedido. Endereço do projeto e ambiente ficam em `interno.configuracao` (não é segredo).
- **Fila em `public`, fechada:** a Edge Function só alcança o schema `public` pela API, então `verificacao_fila` e as funções `verificacao_*` ficam em `public`, mas só com GRANT para `service_role`.

**D-32 · 03/10/2026 · Exportação completa por município (RF19)**
- O admin pede no painel (Administração → Exportar dados); a Edge Function `exportar` gera um ZIP com **todas as tabelas do município em JSON e CSV** (`;` e BOM, abre no Excel), `arquivos.csv` com o endereço público de cada arquivo, `arquivos-enderecos.txt` (para `wget -i`) e um LEIA-ME. Fica no bucket privado `exportacoes` (pasta = município); download por link assinado de 5 min; guarda as 3 últimas.
- **Os arquivos (PDFs, imagens) não vão no ZIP:** em Jeriquara são 7 GB, inviável numa Edge Function. Ficam públicos no endereço listado; a cópia integral, quando pedida (ex.: fim de contrato), é feita pela SECKE com um script (pendência).
- **Fica de fora:** notas internas da SECKE nos chamados, a coluna técnica `busca` e dados de outros municípios. Usuários: só nome, e-mail e cargo de quem é membro do município. A auditoria sai só em JSON (no CSV, o antes/depois em JSON por célula não serve e dobrava o custo).
- **Limites da Edge Function descobertos no teste (~150 MB de memória, 2 s de CPU por chamada):** a 1ª versão (tabela inteira na memória) estourou a memória na auditoria (20 mil linhas); a 2ª (compressão em JavaScript) estourou a CPU. Versão final: lê de 1.000 em 1.000, comprime com o deflate **nativo** (`CompressionStream`), processa tabelas até um orçamento por chamada, guarda os pedaços comprimidos numa pasta temporária com manifesto e **chama a si mesma** para continuar; o último passo só junta os pedaços num ZIP (escritor de ZIP próprio, sem recomprimir). Escala para municípios maiores.
- **Testado em Jeriquara (homologação):** 2 chamadas, ~40 s, ZIP de 7,6 MB com 60 arquivos, CRC íntegro, contagens iguais ao banco; baixado como admin por link assinado; pasta de outro município negada.
- **Verificação de links testada:** 5.018 links em ~2 min (4.972 arquivos conferidos no banco), 217 problemas: 422 registros "não encontrado" são os anexos antigos que já sumiram do site atual (item 2.7 da reunião) e alguns sistemas com DNS/certificado inválido. O teste revelou que duas execuções podiam concluir a mesma verificação e duplicar os problemas: corrigido na 0014 (trava na conclusão).

**D-33 · 04/10/2026 · Auditoria automática de acessibilidade (eMAG)**
- **Ferramenta:** `npm run acessibilidade` no painel (`painel/e2e/acessibilidade.mjs`, axe-core com Playwright, regras WCAG 2.0/2.1/2.2 nível A e AA, que é a base do eMAG). Só lê; por padrão roda contra a homologação publicada (`PORTAL_URL`/`PAINEL_URL` para outro endereço). Gera `painel/e2e/relatorios/acessibilidade.md` e sai com erro se houver problema.
- **Cobertura:** portal (páginas principais, notícia e documento reais, busca, 404) no computador e no celular, com e sem alto contraste; painel (login, recuperação de senha e as 28 telas, inclusive a edição de uma notícia com o editor de texto), logado como admin.
- **Resultado em 04/10/2026:** 67 páginas, **0 problemas**. Conferido que o axe detecta erros nesta configuração (página com 6 erros plantados) e que o painel foi auditado logado.
- **Limite:** testes automáticos acham só parte dos problemas (~30–40%). Continuam necessários teste com leitor de tela (NVDA) e navegação só por teclado (pendência). **As cores do tema de cada prefeitura podem quebrar o contraste:** rodar a auditoria de novo depois de configurar a identidade visual (checklist).

**D-34 · 04/10/2026 · Backup extra: GitHub Actions → Cloudflare R2, criptografado e com teste de restauração**
- **Como:** workflow `.github/workflows/backup-banco.yml`, todo dia às 3h de Brasília: `pg_dump` 17 (igual ao servidor) dos schemas `public` e `interno` e, só os dados, de `auth.users`, `auth.identities` e do índice do Storage; criptografia GPG AES-256; envio ao R2 (`<ambiente>/<data>/backup.tar.gpg`); retenção de 30 dias pela regra de ciclo de vida do bucket. Passo a passo e restauração em `docs/12-backup-e-restauracao.md`.
- **Teste de restauração em toda execução:** restaura num Postgres 17 descartável (com os papéis e funções do Supabase simulados, como no teste de RLS) e compara as contagens das tabelas principais com a origem. O envio ao R2 vem antes do teste: o backup fica guardado mesmo se o teste falhar, e a falha avisa por e-mail.
- **Criptografado** porque o dump tem dados pessoais (e-mails de usuários do painel, LGPD). Sem a `BACKUP_SENHA`, nenhum backup abre: ela precisa estar também fora do GitHub.
- **Conexão pelo Session pooler** (porta 5432): a conexão direta do Supabase é só IPv6, e o GitHub Actions usa IPv4.
- **Fora do escopo por enquanto:** os arquivos (PDFs, imagens, 7 GB em Jeriquara) não entram no dump; ficam no Storage do Supabase. Pendência: cópia periódica do Storage para o R2.
- **Cuidado corrigido na revisão:** a 1ª versão escolhia a conexão com `producao && A || B`, que, com o segredo da produção vazio, faria o backup da homologação com o nome de produção. Agora cada ambiente só usa o próprio segredo.
- **Corrigido no 1º teste real:** o teste não restaurava os usuários do login, então `perfis` e `equipe_plataforma` ficavam vazias sem o teste perceber; e o doc mandava restaurar o conteúdo antes dos usuários (os perfis seriam recusados). Agora o backup guarda também a estrutura de `auth.users`/`auth.identities`/`storage.*`, o teste restaura os usuários primeiro e confere `perfis` e `membros`.
- **Validação de entrada:** o workflow confere antes de começar se a conexão é a URI do Session pooler e se as chaves do R2 têm 32 e 64 caracteres (o 1º cadastro tinha só a senha no lugar da URI).
- **Produção funcionando em 04/10/2026:** `producao/2026-10-04/backup.tar.gpg` no R2, restauração conferida (usuários, perfis, páginas, auditoria iguais à origem).

**D-35 · 04/10/2026 · PNTP 2026: matriz oficial no banco, acompanhamento no painel e critérios de acessibilidade no portal**
- **Fonte:** matriz oficial da Atricon, ciclo 2026 (`criterios_pntp_2026.zip`, "Matriz de Critérios 2026 (Final).xlsx", em pntp.atricon.org.br/dados-abertos). Migration 0015 carrega os **181 critérios** de todos os tipos de órgão, com matriz, dimensão, código, classificação (12 essenciais, 110 obrigatórios, 59 recomendados no total) e os aspectos que o tribunal avalia (atualidade, série histórica, exportação de relatórios, filtro). Para uma **prefeitura valem 96** (matrizes COMUM, COMUM (EXCETO ...) e EXECUTIVO); a seleção fica no painel. Ciclo novo = nova migration (o id inclui o ciclo).
- **Sugestão de evidência genérica:** para 48 critérios o próprio portal costuma ser a evidência (busca, estrutura organizacional, legislação, documentos por categoria, e-SIC, ouvidoria, Carta de Serviços, privacidade, acessibilidade); a migration guarda o caminho e uma nota do que falta. O resto depende de link ou documento da prefeitura (receitas, despesas, folha, diárias, obras etc.).
- **Painel → Estrutura → PNTP** (admin): resumo (atende, em parte, não atende, não verificado, não se aplica; essenciais atendidos de 12), filtros, situação por critério, link de evidência (o PNTP exige um para cada "sim") e observação. O botão "Preencher links sugeridos" só preenche links; **nunca marca "atende" sozinho**. Aviso fixo: apoio à organização, sem garantia de nota (RF11).
- **Portal, genérico para todos:** botões A-, A e A+ de tamanho do texto, guardados no navegador e aplicados antes da pintura (13.4); símbolo de acessibilidade na barra (13.1); página **/mapa-do-site** legível por pessoas (13.5; antes o link ia para o XML dos buscadores); botão do **Radar da Transparência** no rodapé (2.9; `config.radar_transparencia = false` esconde).
- **Testado:** tela do PNTP no painel publicado (96 critérios, 48 sugestões, gravação de situação, filtro de essenciais = 12); tamanho do texto no navegador (17 → 21,25 px, mantido ao recarregar); auditoria de acessibilidade 69 páginas, 0 problemas (ela pegou um erro meu: `role="group"` direto no `<li>` quebrava a lista; corrigido).
- **Aplicação:** a 0015 foi aplicada primeiro na **produção**, por engano de seleção no topo do Supabase, e depois na homologação. É inofensivo (só dados de referência e colunas do PNTP, independentes das migrations 0011–0014); registrado no checklist.

**D-36 · 04/10/2026 · Imagens no tamanho certo pelo Images binding da Cloudflare**
- **Problema medido:** as listagens usavam a imagem original (fotos de celular, PNGs gerados por IA de até 2 MB) em cartões de 400 px: página inicial com **4,9 MB** de imagens, lista de notícias com **6,9 MB**.
- **Solução:** rota do portal `/imagem/<largura>/<caminho no Storage>` (`portal/src/pages/imagem/[largura]/[...caminho].ts`) que busca o original e entrega redimensionado em **WebP** pelo Images binding do Worker, com cache de 30 dias na borda. Cartões, destaques, galeria, banners, agenda, fotos de responsáveis e **imagens dentro dos textos** (`otimizarImagensDoTexto`, depois do `htmlSeguro`) passam a usar `srcset`/`sizes`. A imagem de compartilhamento (Open Graph) continua a original.
- **Resultado:** página inicial **249 KB** (-95%), lista de notícias **410 KB** (-94%); um PNG de 2.207 KB virou 34 KB no tamanho do cartão. Auditoria de acessibilidade: 69 páginas, 0 problemas.
- **Cota e custo:** grátis até **5.000 transformações únicas por mês** (cada imagem + largura conta uma vez por mês). Passando disso, a Cloudflare **não cobra**: recusa as novas, e a rota entrega o original (com cache de 1 dia, para tentar de novo). Para economizar cota, só 6 larguras (320, 480, 640, 800, 1200, 1600). Se o volume crescer com várias prefeituras, o plano pago custa US$ 0,50 por 1.000 transformações acima das 5.000.
- **Segurança:** a rota só atende larguras da lista e só imagens da pasta da **própria prefeitura** (o domínio define o município), para um município não gastar a cota de outro; caminhos com `..` são recusados.
- **Alternativas descartadas:** transformação de imagens do Supabase (cobrada por imagem de origem, e com o teto de gastos ligado o excedente falharia sem plano B); gerar miniaturas no upload (exigiria reprocessar 7 mil imagens e mudar o painel).

**D-37 · 12/10/2026 · A linha de `municipios` é a organização contratante (tenant)**
- **Contexto:** o Portal Educação Paulínia (SMEDU) é o primeiro cliente que não é uma prefeitura inteira. A base precisa abrigar secretarias, câmaras e autarquias com separação rigorosa entre elas.
- **Decisão:** cada portal é uma organização isolada, uma linha em `municipios`. Duas organizações da mesma cidade (ex.: Prefeitura e SMEDU de Paulínia) **não** compartilham dados. O nome `municipio_id` fica por compatibilidade. `orgaos` continua sendo o organograma dentro da organização. Migration 0017: `tipo_ente`, `cidade`, `codigo_ibge`, protegidos como a identidade oficial (D-20).
- **Alternativa descartada:** um nível "órgão" abaixo do município como unidade isolada. Exigiria `orgao_id` em cerca de 30 tabelas e reescrever as 90 policies, o Storage e o provisionamento, arriscando o isolamento que já funciona.
- **Junto (0016), correções do diagnóstico de segurança:**
  - `perfis` só entre membros da mesma organização;
  - `is_plataforma`, `tem_papel` e `registrar_acesso_redirecionamento` movidas para o schema `seguranca`, não exposto, com invólucros SECURITY INVOKER de mesmo nome em `public`;
  - `midias` só pública quando usada em conteúdo visível (antes o `storage_path` de anexos em rascunho era listável);
  - proteção contra senhas vazadas ligada no Auth (painel).
- **Repositório do Portal Educação:** `willquerubim2025-oss/Portais-Publicos` (docs, plano e diagnóstico).

**D-38 · 12/10/2026 · Permissões configuráveis por papel, com escopo (fase 1A)**
- **Decisão:** cada organização cria seus papéis e liga/desliga cada permissão, com escopo `rede`, `regiao`, `unidade` ou `proprio`. O catálogo de permissões é global e vem do código: `sincronizar_permissoes()`, só service_role; permissão nova nasce desligada. A autorização é `pode(organização, permissão, unidade, dono)`, sempre no banco (RLS).
- **Fase 1A (0018–0020):** só os módulos novos usam `pode()`: unidades, regiões, equipe gestora e os próprios papéis. Notícias, páginas, destaques e serviços seguem com `membros.papel` até a **fase 1B**, para Jeriquara não mudar.
- **Salvaguardas:**
  - o master é a `equipe_plataforma`, não um papel;
  - o Administrador (papel protegido) não é excluído nem perde `permissoes.gerenciar` e `usuarios.vincular`;
  - ninguém se vincula a si mesmo;
  - só quem tem `permissoes.gerenciar` dá o papel de Administrador;
  - histórico em `log_permissoes`.
- **Também:** equipe gestora em 3 níveis (foto só com `autorizacao_imagem`, regra no banco); um supervisor por unidade; `buscar_unidade()` por nome ou bairro; avisos com frequência e versão; manchete (`publicacoes.prioridade`); cards de serviço com "em breve".
- **Corrigido:** `registrar_auditoria()` e `interno.marcar_cache_pendente()` impediam excluir uma organização (gravavam linhas apagadas em cascata com FK para a organização já excluída).
- **Testes:** 164 verificações, 0 falhas.

**D-39 · 12/10/2026 · O Portal Educação Paulínia é uma configuração deste portal (tema ampliado), não um site à parte**
- **Decisão:** o portal da SMEDU usa o mesmo portal Astro (`portal/`). As exigências de layout dele viram componentes e opções **genéricos** do tema ampliado (D-17), configuráveis por organização em `municipios.tema` e `municipios.config`:
  - seções de largura total com fundos alternados;
  - destaque (hero) em carrossel com cerca de metade da altura da tela;
  - avisos em faixa e em modal, uma vez por visitante (campos da 0020);
  - cards de serviço vivos com "em breve";
  - equipe gestora;
  - busca do supervisor por escola.
- **Motivo:** "configuração, não código" (D-10). O portal já resolve SEO, acessibilidade, cache, imagens e 301, e a meta de vários portais públicos exige que cada novo portal saia de dados.
- **Alternativa descartada:** um site React + Vite separado para a SMEDU. Duplicaria o que o portal resolve, seria SPA (vetado em D-16) e não se replicaria.
- **Identidade da SMEDU (corrigida em 12/10/2026, a pedido do usuário):**
  - **estrutura** (barra do ente, cabeçalho, menu, rodapé) no verde-petróleo do site da Prefeitura de Paulínia, medido nos pixels renderizados: petróleo `#004348`, turquesa `#24a9b3` (escuro `#127882` para texto e botões), fonte Montserrat;
  - **meio da página** com cores vivas que o portal da Prefeitura não usa, para dar identidade própria: amarelo `#f5b700` (acento; texto `#8a5a00` sobre `#fff4d1`), lilás `#7356c4`/`#efeafa`, coral `#c2412d`/`#fdebe7`, anil `#3b4fb8`/`#eaedfa`;
  - textos em Source Sans 3;
  - contrastes com texto branco: petróleo 11,07; turquesa escuro 5,20; anil 7,01; lilás 5,44; coral 5,14; amarelo sobre petróleo 6,15 (todos ≥ 4,5, eMAG/WCAG AA).
  - **Erro registrado:** a primeira proposta usou marinho `#113567`, tirado das variáveis CSS do site da Prefeitura, mas o site renderiza verde. Lição: medir a cor na tela renderizada, não no CSS.
  - Amostra: `docs/design/sistema-visual.html` no repositório `Portais-Publicos`.

**D-40 · 12/10/2026 · Menu da SMEDU é dado; o portal marca um item só e grupos de menu abrem pelo teclado**
- **Decisão:** o menu principal do Portal Educação fica em `menus`/`menu_itens` (sem código). Proposta cadastrada na homologação: Início · A Secretaria (Equipe gestora, Estrutura organizacional, Legislação, Documentos, Perguntas frequentes) · Matrícula · Escolas e supervisores · Notícias · Agenda · Serviços · Transparência. Ela é voltada aos pais: o que eles mais procuram vem primeiro.
- **Correções genéricas no portal, que valem para todos os municípios:**
  - só um item do menu fica marcado como página atual, o de endereço mais longo que casa com a página. Antes, em `/servicos/matricula-escolar`, "Matrícula" e "Serviços" ficavam marcados juntos;
  - item de menu sem link e com submenu agora é um botão (`aria-expanded`) que abre com clique, Enter ou espaço, e fecha com Esc. Antes era um texto sem foco, e quem navega por teclado não chegava ao submenu.
- **Páginas internas no layout vitrine:** migalhas e título numa faixa neutra de ponta a ponta (a cor primária bem clara), com o traço da cor de acento sob o título. Cartões de notícia com sombra e elevação, resumo limitado a 4 linhas e submenu no estilo da vitrine. Tudo foi verificado no axe (WCAG 2.1 AA), com e sem alto contraste, e sem violações.
- **Ajuste de 12/10/2026, a pedido do usuário:** o aviso informativo (faixa acima do destaque) e a faixa do título das páginas internas eram amarelos e destoavam do verde logo abaixo do menu. Passaram a usar um tom neutro tirado da cor primária (6% sobre branco), com um ponto turquesa marcando o aviso. O amarelo fica só nos botões de ação e nos detalhes. Regra: **uma faixa encostada na estrutura (menu) usa o tom neutro; as cores vivas ficam nas seções do meio.**

**D-41 · 12/10/2026 · Layout vitrine: cabeçalho único, margens laterais e tipografia do portal da Prefeitura (a pedido do usuário)**
- **Cabeçalho único:** a barra fina "Prefeitura de Paulínia / Voltar ao site" e a barra de acessibilidade saíram do topo. Numa linha só ficam o brasão com o nome, a busca, as ferramentas de acessibilidade (botões redondos: acessibilidade, A−, A, A+, alto contraste) e o botão "Site da Prefeitura". Assim o destaque sobe cerca de 90 px.
  - Os atalhos do eMAG (1 a 4, com accesskey) continuam existindo: ficam ocultos e aparecem no topo assim que recebem foco (Tab ou accesskey).
  - O layout clássico não muda; o componente `Ferramentas.astro` atende os dois layouts.
- **Margens (substitui a largura total de D-39):** em telas a partir de 1100 px, o destaque fica com cantos arredondados e margem lateral de 3 cm, e o cabeçalho, o menu e o aviso se alinham a ele. O conteúdo das seções, das páginas internas e do rodapé fica com margem de 6 cm, como no portal da Prefeitura; os fundos das seções continuam de ponta a ponta. Entre 800 e 1100 px as margens diminuem. As duas medidas são configuráveis (`tema.margem_destaque`, `tema.margem_secoes`).
- **Tipografia:** a fonte do portal da Prefeitura, medida na página renderizada, é a **Prompt** (Google Fonts, aqui auto-hospedada por @fontsource). Hierarquia copiada de lá:
  - título de seção: 20 px, peso 600, com as duas barrinhas turquesa antes;
  - título de card: 16 px, peso 700;
  - rótulos e "ver mais": 12–13 px em caixa alta;
  - menu: caixa alta, 13 px, peso 600.
  - O h1 das páginas internas fica em 28 px, peso 600, e o título do destaque em até 42 px, peso 700.
- **Verificação:** axe (WCAG 2.1 AA), com e sem alto contraste, sem violações na home e em Notícias.

**D-42 · 12/10/2026 · Cabeçalho do layout vitrine em linha única, no verde da Prefeitura (a pedido do usuário; ajusta D-41)**
- **Decisão:** numa linha só ficam o brasão com o nome da Secretaria, os itens do menu, o botão de busca e o botão de acessibilidade. O fundo é a cor primária do tema (petróleo `#004348`, o verde predominante do portal da Prefeitura), com texto branco e um filete turquesa embaixo. A barra separada do menu deixou de existir. O cabeçalho tem 79 px de altura em 1280 px ou mais de largura.
- **Busca e acessibilidade** abrem painéis brancos sob o cabeçalho, um de cada vez:
  - painel de acessibilidade: página de acessibilidade, A−, A, A+, alto contraste e "Site da Prefeitura";
  - os painéis fecham com Esc;
  - o atalho 3 ("Ir para a busca") abre o painel da busca;
  - sem JavaScript, os painéis ficam sempre visíveis numa faixa abaixo da linha.
- **Brasão:** o brasão colorido fica num quadro branco de cantos arredondados, para não perder a leitura sobre o fundo escuro.
- **Larguras:** o cabeçalho usa uma margem menor que a do destaque, `min(margem_destaque, 3vw)`, para os itens do menu caberem.
- **Telas menores:** até 1180 px de largura o menu não cabe e vira o botão "Menu", abaixo da marca.
- **Verificação:** axe (WCAG 2.1 AA) sem violações em 1920, 1366, 1280, 1024 e 390 px, com os painéis abertos e em alto contraste.

**D-43 · 12/10/2026 · Régua de título das seções da home (layout vitrine)**
- **Decisão:** inspirada na barra que separa as seções no portal da Prefeitura, mas com desenho próprio para não ficar igual:
  - barra de cantos arredondados (16 px), não em pílula. É cinza-esverdeada sobre fundo branco e branca com sombra sobre os fundos coloridos;
  - à esquerda, um marcador vertical em degradê do amarelo (acento) para o turquesa;
  - à direita, o link "Todas as…" em texto e um botão redondo amarelo com seta. O amarelo não aparece no portal da Prefeitura.
- Serviços ganhou o link "Todos os serviços".
- **Verificação:** axe sem violações, com e sem alto contraste.

**D-44 · 12/10/2026 · Bloco "Em foco" e equipe gestora em cards compactos (layout vitrine, a pedido do usuário)**
- **Em foco (bloco novo `foco`):** divisões ou programas com muita procura do cidadão ganham, na home, um card grande com foto, chamada, título, texto, atalhos em pílula e botão amarelo. O conteúdo vem de `config.home.foco` (lista); cada card usa uma cor viva (`cor`). Os cards alternam o desenho (foto em cima ou embaixo), a largura (7/5 da grade) e a altura, para dar movimento à página. A seção tem fundo próprio (branco → neutro) e fica fora da alternância de fundos. Na SMEDU: Matrícula escolar (anil) e Bolsa de estudo (lilás).
- **Equipe gestora:** os três níveis ficam numa seção só, com cards compactos:
  - direção: cards maiores, com foto de 84 px, filete da cor primária e cargo em caixa alta;
  - supervisão e divisões: grade de cards pequenos, com foto de 56 px.
- **Homologação:** para a apresentação, a equipe é **fictícia**. São nomes inventados, e as fotos vêm do randomuser.me, retratos de banco de imagens para protótipo. As fotos do "Em foco" vêm do Unsplash. Tudo isso tem de sair antes de qualquer publicação real.

**D-45 · 12/10/2026 · Sem amarelo: acento salmão e "areia" no lugar do amarelo; "Em foco" em faixas horizontais (a pedido do usuário)**
- **Cores:** o amarelo foi considerado alarmante.
  - O acento (`tema.cor_acento`), usado nos botões de ação, na régua das seções, no indicador do carrossel e no traço sob os títulos, passou a ser salmão claro `#f2c2a9`. O texto petróleo sobre ele tem contraste 6,9.
  - A primeira cor viva passou de amarelo para "areia": forte `#8a5a3c` (branco sobre ela: 5,8) e claro `#f7efe6`.
  - O chip "Em breve" segue o tema, sem cor fixa. O anel de foco do teclado continua amarelo, porque é recurso de acessibilidade e só aparece na navegação por teclado.
- **Em foco:** cada card ocupa a largura toda, com foto de um lado e painel colorido do outro, e os lados alternam. Os cards ficam empilhados e têm a mesma altura mínima. No celular, a foto vai para cima.

**D-46 · 12/10/2026 · Régua das seções em verde-água claro (a pedido do usuário; ajusta D-43)**
- **Fundo da régua:** verde-água claro `#d5ede6` (`tema.cor_regua`, configurável). Sem esse campo, usa a cor secundária a 18% sobre branco. É o mesmo em todas as seções, sem sombra.
- **Hierarquia:** título em petróleo (contraste 9,0), link "Todas as…" em petróleo com um toque de turquesa e peso 600 (6,3), botão redondo petróleo com seta branca e marcador vertical em degradê petróleo → turquesa. O salmão (acento) fica só nos botões de ação, porque sobre o verde ele quase some (1,3).

**D-47 · 13/10/2026 · Cabeçalho do layout vitrine em carrossel de duas telas (experimento a pedido do usuário)**
- **Decisão:** em telas a partir de 1181 px, o cabeçalho tem duas telas que deslizam da direita para a esquerda, com transição de 2 s:
  - tela 1: brasão, nome da Secretaria e campo de busca já aberto;
  - tela 2: o menu, com fonte maior (≈15 px).
  - Para a volta também andar para a esquerda, a tela 1 é clonada no fim da pista; o clone fica oculto a leitores de tela e inerte.
  - À direita, fixos, ficam os pontos para escolher a tela, o botão de pausa e o botão de acessibilidade.
- **Configuração:** `config.cabecalho` = `{ carrossel, intervalo_s, transicao_s }`. Ligado por padrão no vitrine, com 7 s parado em cada tela e 2 s de transição, dentro de limites seguros.
- **Acessibilidade (WCAG 2.2.2, Pausar, parar, ocultar):**
  - o carrossel para com o mouse em cima ou o foco do teclado dentro dele;
  - para de vez ao digitar na busca, ao usar os pontos ou o botão de pausa;
  - o foco numa tela a mostra na hora;
  - os atalhos do eMAG 2 (menu) e 3 (busca) levam à tela certa;
  - com "reduzir movimento", sem JavaScript ou em telas menores, as duas telas aparecem uma abaixo da outra, sem animação.
- **Risco a avaliar com a SMEDU:** o menu fica visível só metade do tempo. Se atrapalhar a navegação, basta `carrossel: false`.
- **Verificação:** axe sem violações em 1366 px, no celular e com "reduzir movimento".

**D-48 · 13/10/2026 · Cores vivas suavizadas e nome da Secretaria em uma linha (a pedido do usuário; ajusta D-39 e D-45)**
- **Paleta "viva" da SMEDU:** o lilás e o anil destoavam do restante e saíram. A paleta passou a ser:
  - areia `#8a5a3c`/`#f7efe6`;
  - salmão `#a8482a`/`#fbe3d6`;
  - coral `#c2412d`/`#fdebe7`;
  - verde `#286b4f`/`#dcefe6`.
  - Contrastes: branco sobre o forte, de 5,3 a 6,4; forte sobre o claro, de 4,7 a 5,3; petróleo sobre o claro, cerca de 9.
- **Em foco:** os painéis passaram a usar o tom **claro** da cor do card: salmão claro na Matrícula, verde claro na Bolsa. O texto fica em petróleo e cinza-escuro, as pílulas têm contorno petróleo e o botão é petróleo com texto branco. Não há mais painel de cor forte com texto branco.
- **Cabeçalho:** "Secretaria Municipal de Educação" fica em uma linha, entre 18 e 22 px, a partir de 1181 px de largura. Em telas menores pode quebrar a linha.
- **Verificação:** axe sem violações em 1920, 1366 e 390 px, e em alto contraste.

**D-49 · 13/10/2026 · Destaque sem película verde (teste) e brasão na tela do menu (a pedido do usuário)**
- **Película do destaque:** a película verde sobre as fotos foi trocada por uma neutra, que só escurece o lado do texto: preto a 62% → 38% → transparente, mais um escurecimento leve embaixo e sombra no texto. A foto mantém as cores reais. A opção fica no tema (`tema.filtro_destaque`: `'cor'`, o padrão, ou `'neutro'`), para comparar e voltar sem mexer no código.
- **Brasão na tela 2 do cabeçalho:** a tela do menu passou a mostrar o brasão (sem o nome) na ponta esquerda, como link para a página inicial. Ele fica fora da ordem de tabulação, para não repetir o link da marca.

**D-50 · 13/10/2026 · Régua com título centralizado e "Ver todas…" ao fim da seção (a pedido do usuário; ajusta D-43 e D-46)**
- A régua das seções ficou só com o título, centralizado. Saíram o link e o botão redondo com a seta.
- O acesso à lista completa virou um link simples e centralizado no fim da seção:
  - Notícias: "Ver todas as notícias →";
  - Serviços: "Ver todos os serviços →";
  - Agenda: "Ver a agenda completa →".

**D-51 · 13/10/2026 · Cards de Serviços com fundo colorido claro, menores e mais espaçados (a pedido do usuário)**
- **Fundo:** cada card usa o tom **claro** da sua cor viva, com borda da cor forte a 25%. O ícone fica num quadrado branco.
- **Cores:** os cards pulam a cor 0, que é a do fundo da seção, e alternam entre as demais (na SMEDU: salmão, coral e verde).
- **"Em breve":** o mesmo tom, mais lavado, com borda tracejada.
- **Tamanho e espaçamento:** cards menores (largura mínima de 250 px, padding e fontes reduzidos, ícone de 46 px), com espaço de 1,75 a 2 rem entre eles. A grade fica limitada a 1000 px de largura.
- **Verificação:** axe sem violações, com e sem alto contraste.

**D-52 · 13/10/2026 · Paleta própria e mais colorida para os cards de Serviços (a pedido do usuário; ajusta D-51)**
- **Paleta:** os cards de Serviços passaram a usar uma paleta própria, `tema.cores_cards` (`{ nome, forte, claro }` em `#rrggbb`), separada das cores vivas do restante do portal. Os fundos são tons claros um pouco mais saturados, para dar cor à seção. Na SMEDU, em sequência:
  - azul `#cfe0f7`/`#2c5aa0`;
  - abóbora `#fbd6b8`/`#8f400c`;
  - roxo `#e0d4f5`/`#6a44b0`;
  - verde `#cdebd9`/`#22694a`;
  - rosa `#f8d0dc`/`#a3304f`;
  - turquesa `#c9ecee`/`#13707a`.
  - Contrastes: título petróleo de 7,9 a 8,8; texto cinza de 5,0 a 5,6; "Acessar" na cor forte de 4,6 a 5,2.
- Sem `cores_cards`, os cards voltam às cores vivas do tema (D-51).
- **Tamanho e espaçamento:** cards ainda menores (largura mínima de 220 px, grade de até 860 px, ícone de 42 px, título de 15 px, texto de 13,6 px) e mais espaçados (2,25 a 2,5 rem).
- **Verificação:** axe sem violações no computador, no celular e em alto contraste.

**D-53 · 13/10/2026 · Bloco "Eventos": calendário e painel do evento (a pedido do usuário, inspirado no portal de Sumaré)**
- **Bloco novo `calendario`** (título padrão "Eventos"), depois de Serviços. A seção tem fundo cinza médio (`#dde3e2`) de ponta a ponta e fica fora da alternância de fundos.
- **Calendário à esquerda:** mês com navegação (anterior, seguinte e "Hoje"), limitado aos meses carregados, do mês anterior ao atual até 3 meses à frente. Os dias com evento ficam marcados em verde-água com um ponto salmão, e o dia de hoje tem um contorno turquesa. Mouse ou foco num dia com evento mostram uma caixinha com nome, horário e local. O clique abre o evento no painel.
- **Painel à direita:** encarte ou foto do evento (`eventos.imagem_id`) com selo de data, título, quando, horário, local, quem realiza (`eventos.orgao_id`), resumo e o botão "Ver detalhes do evento". Sem imagem, aparece um bloco em degradê com a data grande. Ao abrir a página, o painel mostra o próximo evento.
- **Sem JavaScript:** cada dia com evento é um link para a página do evento.
- **Acessibilidade:**
  - o nome acessível de cada dia inclui a data e os eventos;
  - a caixinha é `role="tooltip"` ligada por `aria-describedby` e fecha com Esc;
  - o painel é `aria-live="polite"`;
  - "reduzir movimento" desliga as animações.
- **Dados:** consulta `eventosCalendario` (eventos publicados no intervalo, pela RLS) e fuso America/Sao_Paulo. O bloco "agenda" (lista) continua disponível; na SMEDU, foi substituído pelo calendário.
- **Homologação:** 7 eventos. Só a prova do Vestibulinho (18/10) é real; os outros 6, e os 4 órgãos que aparecem como realizadores, são fictícios (`legado.ficticio = true`).

**D-54 · 14/10/2026 · Cor do cabeçalho configurável; teste com `#00A693` (a pedido do usuário)**
- **Configuração:** dois campos novos no tema, `tema.cor_cabecalho` (fundo do cabeçalho vitrine) e `tema.cor_cabecalho_texto` (texto, ícones, pontos e bordas do cabeçalho). Sem eles, valem a cor primária e o branco. O destaque do item de menu atual passou a clarear o fundo, em vez de escurecer, para funcionar com qualquer cor de texto.
- **Teste com `#00A693` (verde-turquesa médio):**
  - texto branco: contraste de **3,05:1**, abaixo do mínimo de 4,5:1 do eMAG/WCAG AA para o menu e a busca. O axe aponta 2 falhas na tela 1 e 8 na tela 2;
  - texto verde-escuro `#002a2d`: contraste de 5,0:1, **sem falhas**.
- **Na homologação** fica a versão acessível, com fundo `#00A693` e texto `#002a2d`, até a decisão do usuário. As duas prévias estão em `docs/previa/` do repositório Portais-Publicos.

**D-55 · 14/10/2026 · Notícias em duas fileiras, fundo cinza, botões brancos; cabeçalho de volta ao petróleo (a pedido do usuário)**
- **Notícias:**
  - **1ª fileira:** cinco cards menores, com foto em cima, data, título e resumo de até 3 linhas;
  - **2ª fileira:** dois cards grandes lado a lado, com a manchete (prioridade 'principal') e a notícia seguinte;
  - **telas menores:** a 1ª fileira passa a 3, 2 e 1 colunas, e os grandes ficam um abaixo do outro.
- **Fundo cinza configurável:** `config.home.fundo_cinza` (lista de blocos; padrão: só o calendário). Na SMEDU, Notícias e Eventos. Esses blocos ficam fora da alternância de fundos.
- **Botões de ação** (`.v-botao-acento`, como o do destaque): fundo branco com texto petróleo, no lugar do salmão.
- **Cabeçalho:** o teste com `#00A693` (D-54) foi descartado e o tema voltou ao fundo petróleo com texto branco. Os campos `cor_cabecalho` e `cor_cabecalho_texto` continuam disponíveis para outros órgãos.

**D-56 · 14/10/2026 · Régua das seções de ponta a ponta; Eventos antes de Serviços (a pedido do usuário)**
- A faixa verde-água com o título da seção passou a ir até as bordas da tela. O fundo é estendido com `box-shadow` e `clip-path`, sem criar rolagem horizontal, e o título continua centralizado no miolo. Saíram os cantos arredondados.
- **Ordem dos blocos na SMEDU:** destaque, Notícias, Em foco, Eventos, Serviços, Equipe gestora.

**D-57 · 14/10/2026 · Cabeçalho claro e destaque compacto, inspirados no portal da PBH (experimento a pedido do usuário)**
- **Referência:** a parte de cima de https://prefeitura.pbh.gov.br/ (captura enviada pelo usuário). A barra azul da PBH ficou no verde-petróleo do cabeçalho atual.
- **Configuração:** `config.cabecalho.estilo = 'claro'`, com o botão de ação em `config.cabecalho.botao` (`{ rotulo, url }`, URL relativa ou `https://`). Sem `estilo`, nada muda: continua o cabeçalho em carrossel (D-47). Com `'claro'`, o carrossel do cabeçalho é desligado.
- **Barra de acessibilidade:** estreita, visível, na cor do cabeçalho (`tema.cor_cabecalho` ou a primária).
  - À esquerda, os atalhos do eMAG separados por "|".
  - À direita: Acessibilidade, A−/A/A+, Alto contraste e "Site da Prefeitura".
  - Embaixo, uma faixa de 5 px em quatro cores, como a da PBH. As cores vêm de `tema.cores_faixa`; sem esse campo, usa secundária, acento e as cores vivas 1 e 3.
  - No celular, os atalhos ficam ocultos até receberem foco.
- **Cabeçalho branco**, mais alto (112 px):
  - brasão em cores (76 px, sem a caixa branca) e nome da Secretaria em petróleo;
  - menu em caixa alta;
  - lupa que abre a busca num painel; o atalho 3 também abre esse painel;
  - botão em pílula com ícone de conversa. Na SMEDU, a proposta é "Fale com o supervisor" → `/fale-com-o-supervisor`.
  - **Menu:** fica na linha da marca quando cabe nela. Um script mede o espaço; sem JavaScript, ou sem espaço, o menu desce para uma segunda linha. Os 8 itens da SMEDU cabem numa linha a 1920 px e ficam em duas linhas a 1440 px. Abaixo de 1181 px, vale o botão "Menu" de sempre.
- **Aviso informativo:** vira uma caixa com borda, alinhada ao cabeçalho, como o aviso de manutenção da PBH.
- **Destaque compacto:**
  - alinhado ao cabeçalho, com altura entre 300 e 400 px (cerca de 24% da largura da tela). Antes, ocupava cerca de metade da altura da tela;
  - setas laterais redondas, pausa redonda no canto superior esquerdo (ícone, com o nome acessível mantido) e indicadores numerados embaixo, ao centro;
  - no celular, as setas somem.
- **Verificação:** axe (WCAG 2.1 A/AA) sem violações na barra, no cabeçalho, no aviso e no destaque, a 1440 e a 390 px, com e sem alto contraste. A lupa leva o foco ao campo de busca.
- **Prévia:** `docs/previa/cabecalho-claro.html` no repositório Portais-Publicos. Foi montada sobre a prévia de 13/10, porque o ambiente de nuvem da sessão não alcança o Supabase. O campo ainda **não** foi ligado na homologação: o usuário decide depois de ver a prévia.

**D-58 · 14/10/2026 · Bloco de cima mais estreito, na largura do modelo da PBH (a pedido do usuário; ajusta D-57)**
- No cabeçalho claro, a barra, o cabeçalho, o aviso e o destaque têm largura máxima de **1290 px**, centralizados, como o contêiner da PBH. Numa tela de 1920 px, isso dá cerca de 8 cm de margem de cada lado, o que o usuário pediu. Em telas menores, as margens diminuem até 1 rem. Configurável em `tema.largura_topo` (`'NNNpx'`).
- A altura do destaque compacto passou a `clamp(290px, 22vw, 340px)`, perto da proporção da PBH (1290 × 330 px).
- Com 1290 px, os 8 itens do menu da SMEDU não cabem na linha da marca. Então o menu fica sempre na segunda linha do cabeçalho, pela regra de D-57.
- Verificação: axe sem violações a 1440 e a 390 px, com e sem alto contraste.

**D-59 · 14/10/2026 · Notícias: fileira de cima com 3 cards, na largura do bloco de cima (a pedido do usuário; ajusta D-55)**
- A fileira de cards menores das Notícias passou de 5 para **3** cards na SMEDU, que dividem a largura e ficam maiores (título de 1,05 rem, resumo de 0,9 rem). Os dois cards grandes de baixo continuam.
- **Configuração:** `config.home.noticias_fileira` (de 1 a 5; o padrão é 5, como antes). Com 3 ou menos, a fileira usa cards maiores e fica em 3 colunas até 700 px; abaixo disso, em uma coluna.
- No cabeçalho claro (D-57), a seção de Notícias segue a mesma largura do bloco de cima (`tema.largura_topo`, 1290 px), alinhada ao destaque. As seções passaram a ter a classe `v-bloco-<bloco>`.
- Verificação: `astro build` passando; axe sem violações a 1440 e a 390 px, com e sem alto contraste.
- **A ligar na homologação junto com o D-57:** `config.home.noticias_fileira = 3`.

**D-60 · 14/10/2026 · Todo o conteúdo na largura do bloco de cima (a pedido do usuário; ajusta D-41 no cabeçalho claro)**
- No cabeçalho claro (D-57), o conteúdo segue a mesma largura do bloco de cima (`tema.largura_topo`, 1290 px). Valem as mesmas regras em todas as telas, e os fundos das seções continuam de ponta a ponta. A medida vale para:
  - todas as seções da home (Notícias, Em foco, Eventos, Serviços, Equipe gestora);
  - as páginas internas (`main > .container`) e as migalhas;
  - o rodapé.
- Ela substitui as margens de D-41 (6 cm nas seções). Sem o cabeçalho claro, nada muda.
- O destaque compacto também usa essa largura a partir de 800 px, para ficar alinhado no tablet.
- **Serviços:** saiu o limite de 860 px. Os cards ocupam a largura em colunas de no mínimo 340 px: 3 por linha a 1290 px, 2 no tablet e 1 no celular.
- Verificação: tudo alinhado (mesmo x e largura) a 1920, 1440, 1024 e 390 px; axe sem violações na página inteira, a 1440 e a 390 px, com e sem alto contraste.

**D-61 · 14/10/2026 · Seções sem fundo próprio e régua de título na largura do conteúdo (a pedido do usuário; ajusta D-55 e D-56 no cabeçalho claro)**
- No cabeçalho claro (D-57), as seções da home ficam com fundo branco:
  - sem a alternância de tons claros;
  - sem o cinza de `config.home.fundo_cinza`;
  - sem o degradê do "Em foco".
- A régua de título (verde-água) tem a mesma largura do conteúdo (1290 px), com cantos arredondados de 8 px, em vez de ir de ponta a ponta (D-56).
- Sem as faixas de fundo separando as seções, o espaçamento vertical de cada seção diminuiu para `clamp(1,75 rem, 3 vw, 2,75 rem)`.
- No alto contraste, as seções ficam pretas e a régua ganha borda branca.
- Sem o cabeçalho claro, nada muda.
- Verificação: `astro build` passando; axe sem violações na página inteira, a 1440 e a 390 px, com e sem alto contraste.

**D-62 · 14/10/2026 · Fonte própria do cabeçalho claro; teste com a Raleway, a do portal da PBH (a pedido do usuário)**
- **Campo novo:** `tema.fonte_cabecalho` (uma de `FONTES_DISPONIVEIS`). Vale só no cabeçalho claro (D-57): barra de acessibilidade, marca, menu, submenu, botão e busca. O resto do portal continua com `fonte_titulos`/`fonte_texto` (Prompt, na SMEDU).
- **Fonte:** a Raleway (OFL) foi incluída, auto-hospedada por `@fontsource/raleway` (pesos 400 a 800, só latino; D-17: sem Google Fonts).
  - Foi identificada pelo desenho no print do usuário: "G" com esporão, maiúsculas largas e algarismos antigos.
  - O CSS da PBH não pôde ser conferido, porque o site não abre no ambiente de nuvem. **Confirmar** pelo F12 no navegador (Computed → font-family).
- **Ajustes com a Raleway:**
  - menu em 700;
  - nome da Secretaria em 800, em duas linhas equilibradas (`text-wrap: balance`, até 21ch): "Secretaria Municipal / de Educação";
  - no celular, nome com 1,05 rem.
- **A ligar na homologação junto com o D-57:** `tema.fonte_cabecalho = 'Raleway'`.
- Verificação: `astro build` passando; axe sem violações na página inteira, a 1440 e a 390 px, com e sem alto contraste.

**D-63 · 14/10/2026 · Cabeçalho claro em uma linha só, como no modelo; largura útil de 1360 px (a pedido do usuário; ajusta D-57 e D-58)**
- O menu fica **entre a marca e a lupa/botão, na mesma linha**, como no portal da PBH. Para os 8 itens da SMEDU caberem:
  - menu com 0,78 rem (≈ 12,5 px) e menos espaço entre os itens;
  - brasão de 66 px; nome com até 1,22 rem e caixa limitada a 10,5 em. Antes, a caixa tinha 21ch e sobrava espaço vazio ao lado do nome;
  - "Prefeitura de Paulínia" com espaçamento entre letras menor;
  - botão mais compacto.
- **Largura útil** de 1290 para **1360 px** (novo padrão de `tema.largura_topo`; ≈ 7,4 cm de margem em tela de 1920 px). Vale para todo o conteúdo (D-60).
- **Resultado:** uma linha só a partir de 1366 px de tela, com altura de 105 px. Abaixo disso, o script de D-57 leva o menu para a segunda linha, e no tablet e no celular continua o botão "Menu". Com um menu maior (outro órgão), vale o mesmo recuo automático.
- Verificação: `astro build` passando; axe sem violações na página inteira, a 1440 e a 390 px, com e sem alto contraste; alinhamento conferido a 1920 e 1440 px.

**D-64 · 14/10/2026 · Menu da SMEDU sem Agenda e Transparência; largura volta a 1290 px e fonte do menu volta ao tamanho de D-57 (a pedido do usuário; ajusta D-63)**
- O usuário não queria a largura de todo o conteúdo alterada em D-63, só a do cabeçalho. Para resolver o espaço do menu de outro jeito:
  - **Agenda** e **Transparência** saem do menu principal da SMEDU. Continuam acessíveis: os Eventos pela home e Transparência pelo rodapé (links obrigatórios);
  - a largura útil volta a **1290 px** em tudo (`tema.largura_topo`, D-58);
  - a fonte do menu volta a 0,88 rem, com o espaçamento de D-57.
- Ficam de D-63 a marca e o botão compactos. Com 6 itens, o cabeçalho fica em **uma linha a partir de 1280 px** de tela (menu com 665 px em 672–711 px disponíveis).
- **Banco (homologação): pendente.** A remoção dos dois itens (`menu_itens` 54904999… "Agenda" e e7d76019… "Transparência", menu principal da SMEDU) não pôde ser feita nesta sessão: as escritas pelo MCP do Supabase excediam o tempo. Fazer pelo painel (Menus) ou por SQL numa sessão com acesso. A prévia já está sem eles.
- Verificação: `astro build` passando; axe sem violações na página inteira, a 1440 e a 390 px, com e sem alto contraste; alinhamento a 1920, 1440, 1024 e 390 px.

**D-65 · 14/10/2026 · Título das seções sem faixa de fundo, como no modelo (a pedido do usuário; ajusta D-43, D-46, D-50 e D-61 no cabeçalho claro)**
- No cabeçalho claro, o título de cada seção da home é só o texto, como no portal da PBH:
  - alinhado à esquerda, na cor primária (petróleo), com `clamp(1,4 rem, 1,2 rem + 0,5 vw, 1,65 rem)` e peso 600;
  - sem a faixa verde-água e sem o marcador vertical em degradê.
- Objetivo do usuário: sensação de mais clareza, limpeza e simplicidade.
- O "Ver todas…" segue centralizado no fim da seção (D-50).
- No alto contraste, o título fica em amarelo sobre preto.
- Verificação: `astro build` passando; axe sem violações na página inteira, a 1440 e a 390 px, com e sem alto contraste.

**D-66 · 14/10/2026 · Destaque compacto desliza da direita para a esquerda; botão "Fale com a Educação" (a pedido do usuário)**
- **Carrossel:** no destaque compacto (cabeçalho claro), os slides deslizam (0,9 s) em vez de esmaecer:
  - ao avançar (automático, seta da direita ou ponto seguinte), o slide atual sai pela esquerda e o novo entra pela direita;
  - ao voltar (seta da esquerda ou ponto anterior), o sentido se inverte.
  - Com "reduzir movimento", troca sem animação e sem passar sozinho.
  - Fora do compacto, segue o esmaecimento de antes.
- **Botão do cabeçalho:** o texto proposto para a SMEDU passa a ser **"Fale com a Educação"** (`config.cabecalho.botao.rotulo`). O link continua `/fale-com-o-supervisor` até a SMEDU definir um canal de contato geral.
- Verificação: posições medidas no meio e no fim da transição, nos dois sentidos; axe sem violações na página inteira, a 1440 e a 390 px, com e sem alto contraste; `astro build` passando.

**D-67 · 14/10/2026 · Serviços no estilo do modelo (PBH): fundo cinza claro e cards brancos centralizados (a pedido do usuário; ajusta D-51/D-52 no cabeçalho claro)**
- **Fundo da seção de Serviços:** cinza bem claro, **#f5f7f9**, medido nos pixels do print do modelo. Vale só nessa seção; as outras seguem brancas (D-61). Variável `--v-fundo-servicos`.
- **Cards:** brancos, com raio de 16 px, sombra suave e conteúdo centralizado:
  - ícone num quadrado claro da cor secundária (turquesa a 28%) com o ícone em petróleo, no lugar do azul da PBH;
  - título em negrito, em petróleo;
  - descrição curta;
  - sem o "Acessar →" visível (fica só para leitor de tela), porque o card inteiro é o link, como no modelo.
- **Interação e "Em breve":** ao passar o mouse, o card sobe e o ícone fica petróleo com o desenho branco. Os cards "Em breve" têm borda tracejada e ícone em cinza.
- A paleta colorida dos cards (`tema.cores_cards`, D-52) deixa de ser usada no cabeçalho claro; segue valendo no layout anterior.
- Verificação: `astro build` passando; axe sem violações na página inteira, a 1440 e a 390 px, com e sem alto contraste.

**D-68 · 14/10/2026 · Destaque compacto troca de slide a cada 4,5 s (a pedido do usuário)**
- O tempo parado em cada slide do destaque compacto passou de 7,5 s para 6,5 s e, em seguida, para **4,5 s**, a pedido do usuário (`data-intervalo` na seção; fora do compacto continua 7,5 s). A animação do deslizamento segue em 0,9 s (D-66).
- Continua com pausa ao passar o mouse, ao receber foco e pelo botão (WCAG 2.2.2).
- Medido na prévia: a primeira troca automática ocorre em 4,5 s.

**D-69 · 14/10/2026 · Cabeçalho branco 10% mais alto (a pedido do usuário)**
- A linha do cabeçalho claro passou de `min-height: 104px` para **116 px**; a altura medida foi de 105 para 117 px. O brasão, a fonte e o menu não mudam; só cresce o respiro em cima e embaixo.
- O menu continua numa linha só a partir de 1280 px de tela.
- Verificação: axe sem violações na página inteira, a 1440 e a 390 px, com e sem alto contraste; `astro build` passando.

**D-70 · 14/10/2026 · "Em foco" mais perto das Notícias (a pedido do usuário)**
- Distância entre o "Ver todas as notícias" e o título "Em foco", em três reduções pedidas pelo usuário (cerca de 15%, 15% e 10%): de 88 para 75, 64 e **58 px** no computador; de 56 para **37 px** no celular.
- Só o espaço de cima do "Em foco" diminuiu: `padding-top: clamp(0,55 rem, 1 vw, 0,875 rem)` no cabeçalho claro. As outras seções não mudam.
- Verificação: medido a 1920, 1440 e 390 px; axe sem violações na página inteira, com e sem alto contraste.

**D-71 · 14/10/2026 · Sem a faixa colorida sob a barra de acessibilidade (a pedido do usuário; ajusta D-57)**
- A faixa fina de quatro cores (inspirada na PBH) saiu: ficam só a barra verde de acessibilidade e o cabeçalho branco.
- Ela vira opcional: só aparece se o órgão cadastrar `tema.cores_faixa`. Antes, sem esse campo, usava as cores do tema. A SMEDU não cadastra.
- Verificação: `astro build` passando; axe sem violações na página inteira, a 1440 e a 390 px, com e sem alto contraste.

**D-72 · 14/10/2026 · Rodapé no estilo do portal da Prefeitura de Paulínia (a pedido do usuário)**
- No cabeçalho claro, o rodapé segue o modelo do portal da Prefeitura (print do usuário), sem a newsletter:
  - **bloco principal:** brasão (96 px) e nome da Secretaria em destaque (fonte do cabeçalho, 800), com "Prefeitura de Paulínia" embaixo. Ao lado, os contatos com ícones em círculos escuros: e-mail e telefone, endereço e horário de atendimento (`config.email`, `telefone`, `endereco`, `horario`);
  - linhas finas separam os blocos;
  - **links institucionais obrigatórios** (Acesso à Informação, Ouvidoria, Transparência, Privacidade, Acessibilidade), mais o menu do rodapé e as redes sociais, se houver;
  - **faixa mais escura:** Mapa do site, Site da Prefeitura e Radar da Transparência Pública (PNTP 2.9);
  - **faixa mais escura ainda:** "© ano + nome do órgão (+ CNPJ, se houver). Todos os direitos reservados."
- O conteúdo segue a largura do bloco de cima (1290 px). No celular, os blocos ficam um embaixo do outro.
- Sem o cabeçalho claro, o rodapé anterior não muda.
- **Em aberto:** crédito do fornecedor (como "Instar Tecnologia" no modelo) e "Portal atualizado em". Não foram incluídos; decidir com o usuário.
- Verificação: `astro build` passando; axe sem violações na página inteira, a 1440 e a 390 px, com e sem alto contraste.

**D-73 · 14/10/2026 · Revisão da página inicial no celular (cabeçalho claro) (a pedido do usuário)**
- **Verificação automática** a 320, 360, 390, 414 e 768 px: rolagem horizontal, elementos passando da tela, áreas de toque abaixo de 24 px (WCAG 2.2, 2.5.8) e textos abaixo de 12 px. Também foram revisadas as capturas da página inteira.
- **Corrigido:**
  1. **Rolagem horizontal a 320–360 px** (44 px e 4 px): a marca (brasão + nome) não encolhia e a lupa ficava por cima do nome. Agora a marca encolhe e o nome quebra no espaço ao lado da lupa e do botão. Abaixo de 400 px: brasão de 46 px e nome com 0,95 rem.
  2. **Áreas de toque de 20–22 px:** Acessibilidade, Alto contraste e Site da Prefeitura, na barra verde, e os links da faixa do rodapé passaram para 28–30 px.
  3. **Textos de 10,9–11,2 px** passaram para 12 px ou mais: "Prefeitura de Paulínia" no cabeçalho, o selo "Em breve", os números do carrossel e os números dos atalhos.
- **Resultado:** 0 problemas nas cinco larguras. O cabeçalho do computador continua numa linha a partir de 1280 px.
- **Observação:** nas capturas automáticas da página inteira, as imagens com `loading="lazy"` às vezes aparecem vazias. É efeito da captura; no navegador elas carregam (conferido rolando até elas).

**D-74 · 14/10/2026 · Moldura verde nos cards de Serviços ao passar o mouse, como no modelo (a pedido do usuário)**
- Ao passar o mouse ou com o foco do teclado, o card de Serviço ganha uma moldura de 1,5 px na cor primária (verde-petróleo `#004348`). No modelo da PBH, ela é azul-escura.
- A borda existe sempre, transparente, para o card não mudar de tamanho.
- Os efeitos de D-67 continuam: o card sobe levemente e o ícone fica petróleo com o desenho branco.
- No alto contraste, a moldura fica amarela.
- Os cards "Em breve" não são links e não têm o efeito.
- Verificação: cor da borda medida no hover; axe sem violações na página inteira, a 1440 e a 390 px, com e sem alto contraste.

**D-75 · 14/10/2026 · Padrão visual da SMEDU aprovado (cabeçalho claro, D-57 a D-74); vale para todas as páginas**
- O usuário aprovou a página inicial no estilo do cabeçalho claro como "a cara do portal". As próximas páginas seguem esse padrão:
  - barra verde de acessibilidade;
  - cabeçalho branco em uma linha, com fonte Raleway;
  - largura de 1290 px;
  - títulos sem faixa;
  - cards brancos com moldura verde no hover;
  - rodapé no estilo da Prefeitura.
- **Páginas internas conferidas** com o CSS atual: lista de notícias, notícia, Matrícula, Carta de Serviços, Fale com o supervisor (com busca), Educação em Números e Bolsa.
  - Já herdam o cabeçalho, a largura e o rodapé, sem rolagem horizontal de 320 a 768 px.
  - Axe sem violações, com e sem alto contraste.
  - Único ajuste: os links da trilha de navegação passaram a ter área de toque de 24 px ou mais.
- **Homologação:** a configuração foi ligada em 14/10/2026, pelo MCP:
  - `config.cabecalho = {estilo: 'claro', botao: {rotulo: 'Fale com a Educação', url: '/fale-com-o-supervisor'}}`;
  - `config.home.noticias_fileira = 3`;
  - `tema.fonte_cabecalho = 'Raleway'`.
  - O portal de homologação só mostra o visual novo depois de publicar o Worker com o código deste branch.

**D-76 · 15/10/2026 · O cabeçalho claro é o padrão do layout vitrine (uma só versão) (a pedido do usuário)**
- O cabeçalho claro e o destaque compacto foram criados como experimento ligado por `config.cabecalho.estilo = 'claro'`, para não comprometer o original. Aprovados (D-75), passam a ser **o padrão do vitrine**:
  - `Base.astro`: `claro = vitrine && estilo !== 'carrossel'`;
  - `index.astro`: `compacto` segue a mesma regra.
- O cabeçalho antigo em carrossel (D-47) continua disponível só com `config.cabecalho.estilo = 'carrossel'`. O layout clássico (Jeriquara) não muda.
- No repositório Portais-Publicos, as prévias também viraram uma só versão: `docs/previa/` com as 15 páginas no padrão aprovado.

**D-77 · 15/10/2026 · Painel: telas de permissões configuráveis (fase 1A no painel)**
- **Registro central das permissões no código:** `painel/src/lib/permissoes.catalogo.json`, lido pelo painel em `lib/permissoes.ts`.
  - O script `npm run permissoes:sincronizar` (com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`) envia o catálogo a `public.sincronizar_permissoes`.
  - Rodar a cada deploy do painel, na homologação e na produção.
- **AuthContext:** reconhece quem tem só papéis configuráveis (`usuario_papeis`, sem `membros`) e carrega `minhas_permissoes()` da organização em edição.
  - Expõe `pode(codigo)` e `podeNaRede(codigo)`.
  - `Acesso.papel` passa a aceitar `null` (sem papel antigo) e ganha `papeis` (nomes dos papéis configuráveis).
- **ExigirAcesso:** além de `papelMinimo`, aceita `permissao` (uma ou lista, basta uma). Sem props, só exige sessão e organização. O conteúdo continua exigindo o papel antigo até a fase 1B.
- **Telas novas:**
  - Papéis e permissões (`/papeis`): criar, editar, desativar e excluir papéis; matriz liga/desliga por módulo, com alcance; histórico de `log_permissoes`. As permissões essenciais do Administrador ficam travadas;
  - Vínculos de usuários (`/vinculos`): dar, suspender e retirar papel, com unidade ou região;
  - Unidades e regiões (`/unidades`): quem só tem `unidades.editar` vê e edita apenas as unidades do seu alcance, e os campos da rede ficam ocultos;
  - Equipe gestora (`/equipe`): três níveis, visível, dados confirmados, foto só com autorização.
- **Menu lateral e início:** o menu é montado por papel antigo ou por permissão. O início de quem só tem papéis configuráveis lista os módulos liberados.
- **Erros:** mensagens 42501 dos gatilhos (ex.: "O Administrador não perde a permissão…") são mostradas como vêm do banco.
- **`package-lock.json` do painel:** estava fora de sincronia na `main` (faltava `@floating-ui/dom`, e o `npm ci` falhava); foi regenerado com `npm install`.
- **Verificação:**
  - `tsc` e build passando;
  - teste com Playwright e o Supabase simulado: as 8 telas abrem com um Administrador configurável da SMEDU, axe sem violações, sem erros no navegador, gravações conferidas (upsert de `papel_permissoes` e insert em `usuario_papeis`);
  - administrador antigo (Jeriquara) com o mesmo menu de antes e sem acesso às telas novas;
  - testes de banco 164/164.
- **Limite até a fase 1B:** quem tem só papéis configuráveis não edita conteúdo, não vê o nome dos colegas e não convida pessoas. Plano em `docs/Plano de Migração — Fase 1B.md`, no repositório Portais-Publicos, aguardando aprovação.

**D-78 · 15/10/2026 · Fase 1B: o conteúdo obedece também aos papéis configuráveis (aprovado pelo usuário: "pode sim")**
- **Como:** em vez de reescrever as ~70 políticas de conteúdo, a migration `0021_permissoes_conteudo` amplia as três funções por onde todas passam (mesmo nome e assinatura, sem `drop`, SECURITY INVOKER como antes):
  - `is_membro` = papel antigo **ou** `conteudo.editar`, `conteudo.publicar` ou `organizacao.administrar`;
  - `pode_publicar` = admin/publicador antigo **ou** `conteudo.publicar` ou `organizacao.administrar`;
  - `is_admin` = admin antigo **ou** `organizacao.administrar`.
  O papel antigo (`membros`) continua valendo exatamente como antes: Jeriquara não muda. O gatilho `checar_permissao_publicacao` não foi tocado (usa `pode_publicar`).
- **Catálogo:** 3 permissões novas, só com alcance `rede` (escopo por unidade fica para a 1C). Entraram também em `painel/src/lib/permissoes.catalogo.json`.
- **Administrador (papel protegido) de cada organização** recebe as três ligadas. Diretor, Professor e Estudante continuam sem elas; o Administrador liga no painel o que decidir.
- **Colegas:** `perfis` passa a usar `seguranca.e_colega(user)`: vê o perfil quem trabalha com conteúdo, vincula ou configura papéis numa organização em que a pessoa tem vínculo antigo ou configurável.
- **Convite (`convidar-usuario`):** aceita `papel_id` (com `unidade_id` ou `regiao_id`). Autoriza por `pode(usuarios.vincular)` e grava em `usuario_papeis` com o token de quem convida (o RLS ainda exige `permissoes.gerenciar` para dar o papel Administrador). O caminho antigo (`papel` → `membros`, exige `is_admin`) não mudou. O convite configurável fica na tela **Vínculos** ("Dar papel a alguém" com o e-mail de quem ainda não tem conta), porque quem só tem `usuarios.vincular` não abre a tela Usuários.
- **Painel:** `AuthContext.nivel` = o maior entre o papel antigo e o equivalente das permissões; `podePublicar`, `isAdmin`, `ExigirAcesso papelMinimo`, menu e início usam esse nível (o mesmo cálculo do banco).
- **Verificação:** testes de banco 183/183 (19 novos: Administrador configurável cria e publica, Redator só rascunho, Diretor não cria, auditoria, identidade, isolamento entre organizações, colegas, desligar permissão vale na hora, editor antigo igual); `tsc` e build; Playwright com Supabase simulado (sem conteúdo → sem Notícias; Redator → Notícias sem Menus; Administrador configurável → tudo e convite com `papel_id`).
- **Aplicado na homologação** (`kvilgamsyneenjtlllcf`) em 15/10/2026: migration + função (v4). Conferido: 3 permissões, Administrador de Jeriquara e da SMEDU com as três ligadas, política de `perfis` nova, admin antigo de Jeriquara com `is_membro`/`pode_publicar`/`is_admin` verdadeiros. Na homologação ainda não há nenhum vínculo em `usuario_papeis`, então ninguém mudou de acesso.
- **Produção:** só depois de conferir na homologação e com aprovação do usuário.

**D-79 · 16/10/2026 · Publicação da homologação por botão no GitHub (a pedido do usuário: "opção 2")**
- O ambiente do Claude na nuvem não alcança a Cloudflare, e o usuário prefere não depender de computador para publicar.
- Rotina `.github/workflows/publicar-homologacao.yml`: em Actions → "Publicar homologação" → Run workflow, escolhe-se painel, portal ou os dois.
  - Painel: `npm ci` + `npm run deploy:homologacao` (Worker `painel-municipal-homologacao`).
  - Portal: `CLOUDFLARE_ENV=homologacao npx astro build`, confere que o `dist/server/wrangler.json` aponta para `portal-municipal-homologacao` e para `kvilgamsyneenjtlllcf`, e então `npx wrangler deploy`.
- Segredos do repositório: `CLOUDFLARE_API_TOKEN` (modelo "Edit Cloudflare Workers") e `CLOUDFLARE_ACCOUNT_ID`.
- **Só homologação, de propósito:** a produção continua manual, pelo `docs/11-checklist-ir-ao-ar.md`, para nunca ir ao ar por engano.
- O segredo `CACHE_SEGREDO` do portal fica no Worker (não é apagado por um deploy novo).

**D-80 · 16/10/2026 · Homologação na conta pessoal da Cloudflare; o endereço abre o Portal Educação (escolha do usuário)**
- A rotina "Publicar homologação" (D-79) usa a conta Cloudflare **willquerubim2025** (a do token cadastrado). O usuário escolheu manter a homologação nela. Substitui, para a homologação, a conta da empresa da D-27 (`comercial@seckesistemas.com`), que fica com a versão de 03/10 parada. A produção ainda não foi publicada em nenhuma das duas, e a conta dela será decidida no checklist de ir ao ar.
- Endereços:
  - painel: https://painel-municipal-homologacao.willquerubim2025.workers.dev;
  - portal: https://portal-municipal-homologacao.willquerubim2025.workers.dev.
- O endereço do portal foi cadastrado em `municipio_dominios` da homologação para a **SMEDU** (`paulinia-educacao`, ambiente `homologacao`, principal). `educacao.paulinia.teste` deixou de ser principal: continua valendo no `localhost` com `DOMINIO_DEV`. Jeriquara continua com `portal-municipal-homologacao.portal-municipal.workers.dev` (conta da empresa, código de 03/10) e `jeriquara.homologacao.teste`.
- `painel/e2e/acessibilidade.mjs` passou a usar os endereços novos por padrão.


**D-81 · 15/10/2026 · Hierarquia de fontes do cabeçalho claro: menu um passo abaixo do nome do órgão (a pedido do usuário) — REVERTIDA no mesmo dia**
- **Revertida em 15/10/2026, a pedido do usuário** ("mexeu no cabeçalho e não era pra mexer; volte apenas o cabeçalho como era antes"): o bloco de CSS saiu de `vitrine.css` e o menu voltou a 0,88rem, como na D-76/D-80. O teste da Raleway (dado, em `tema`) e o pedido de tirar Agenda e Transparência do menu não fazem parte da reversão.
- Pedido: o menu voltar a ficar em uma linha entre a marca (brasão e nome) e a busca, como antes, com tamanhos de fonte em hierarquia harmoniosa.
- Em telas largas (≥ 1181 px), os itens do menu do cabeçalho claro passam de 0,88rem para **0,8rem**, com espaçamento lateral de 0,5rem (era 0,6rem) e espaço entre letras de 0,02em. O nome do órgão continua o maior texto (até 1,22rem) e "Prefeitura de" o menor (0,68rem). Celular sem mudança.
- Vale para todos os municípios com cabeçalho claro (D-10). O script do Base.astro continua levando o menu para a segunda linha se ainda não couber (D-57).
- Junto com isso, o usuário pediu tirar **Agenda** e **Transparência** do menu principal da SMEDU (dado, não código). A exclusão no banco de homologação foi cancelada na confirmação e ficou pendente. Feita depois, em 15/10/2026, pelo usuário no SQL Editor (branch homologacao): o menu ficou com 6 itens e cabe em uma linha com a fonte original de 0,88rem, inclusive com a Raleway em todo o portal (conferido no navegador de 1280 a 1920 px).

**D-82 · 15/10/2026 · Jeriquara fora do projeto; foco no produto multi-organização (pedido do usuário)**
- A dispensa de Jeriquara (028/2026) não foi ganha: **o site de Jeriquara não será feito.** Palavras do usuário: "não se preocupe mais com as questões de Jeriquara… deixa ele aí quietinho por enquanto".
- Os dados de Jeriquara (produção e homologação: organização, migração de 03/10, usuários e papéis antigos em `membros`) **ficam como estão, sem manutenção**. Não testar, não conferir e não planejar trabalho para Jeriquara; não apagar sem pedido. As pendências que eram só de Jeriquara saíram de `07-pendencias.md` (lista no fim do arquivo).
- O norte da D-10 continua e fica mais forte: o produto é **multi-organização** (prefeituras, secretarias, câmaras e outras instituições). O papel antigo em `membros` continua no código porque é genérico, não por causa de Jeriquara.
- A organização em foco é a SMEDU de Paulínia (Portal Educação).

**D-83 · 15/10/2026 · Fase 1B na produção (aprovado pelo usuário: "pode seguir")**
- Aplicada `0021_permissoes_conteudo` na produção; os Administradores (papel protegido) das organizações receberam `conteudo.editar`, `conteudo.publicar` e `organizacao.administrar`.
- Publicada a função `convidar-usuario` (versão 2 na produção, mesmo código da v4 da homologação); sem login responde 401.
- `npm run permissoes:sincronizar` não foi preciso: o catálogo da produção já é igual ao do código (8 permissões, mesmos módulos, nomes, escopos e ordem). Rodar de novo quando o catálogo mudar.
- Base: teste da homologação em 15/10/2026 (redator só edita rascunho; publicar recusado no banco; admin publica e despublica).

**D-84 · 15/10/2026 · Notícia sem foto ganha imagem padrão (pedido do usuário: "pode fazer")**
- Visto no teste da fase 1B: uma notícia sem foto no card grande virava um bloco branco com só o título. Agora a manchete (e os cards pequenos) sem imagem mostram um fundo nos tons do portal (`--v-tom-*`) com um ícone de jornal, na mesma proporção da foto. No alto contraste, fundo preto e ícone amarelo. Vale para todas as organizações (D-10).

**D-85 · 15/10/2026 · Notícias no celular em lista compacta (proposta 3 da revisão de 14/10, aprovada)**
- Até 700 px: a manchete vem primeiro, grande; as demais viram uma lista com a foto pequena (104 px) ao lado da data e do título, sem o resumo. Só CSS (`display: contents` nas duas grades e `order`). A página inicial da SMEDU a 390 px passou de ~8.740 px para ~7.510 px de altura.
- Conferido: 0 problemas no `verificar_responsivo.cjs` (320 a 768 px) e axe sem violações (1440 e 390 px, normal e alto contraste).

**D-86 · 15/10/2026 · Equipe gestora: cards dividem a largura toda (proposta 6, aprovada)**
- `v-equipe-grade` passou de `auto-fill` para `auto-fit`: grupos com poucas pessoas (ex.: 3 supervisores) ocupam a fileira inteira, sem espaço vazio no fim. As iniciais sem foto já existiam (D-44).
- **Revisão de 14/10 (6 propostas), situação em 15/10/2026:** 1) espaços entre seções: já reduzidos nas D-61/D-70, sem mudança; 2) botão de acessibilidade sobre o nome no celular: já resolvido na D-73; 3) Notícias no celular: D-85; 4) destaque de ponta a ponta: **não feito**, porque contraria a D-58 (destaque de 1290 px, no modelo da PBH, aprovado pelo usuário); 5) rodapé com metade vazia: já resolvido na D-72; 6) equipe: D-86.

**D-87 · 15/10/2026 · Cabeçalho branco 15% mais alto no computador (pedido do usuário)**
- "Aumenta a altura em 15%… com mais espaço na vertical." A linha do cabeçalho claro passou de 116 px (D-69) para **133 px** a partir de 1181 px de largura, onde o menu fica numa linha só. Brasão, nome, menu, lupa e botão continuam centralizados na vertical. No celular e em telas até 1180 px, a altura não muda.
- Vale para todos os órgãos com cabeçalho claro (D-10).

**D-88 · 15/10/2026 · Raleway em todo o portal da SMEDU (pedido do usuário)**
- `tema.fonte_texto` e `tema.fonte_titulos` da SMEDU passaram de Prompt para Raleway (já era a fonte do cabeçalho, D-62). O usuário confirmou: "a troca da fonte eu quero". É dado (`municipios.tema`), não código: outras organizações continuam com as fontes que escolherem.

**D-89 · 15/10/2026 · Pendências com a organização num documento único; não parar esperando material (pedido do usuário)**
- Tudo o que depende da SMEDU ou da Prefeitura fica em `docs/reuniao/smedu-pendencias.md` (repositório Portais-Publicos), com resumo, o que está no site hoje e se bloqueia ir ao ar.
- Enquanto a resposta não chega, o trabalho segue com dado público, foto de banco com licença livre ou placeholder, marcando no documento o que ficou provisório. Só se para e cobra se a falta travar o trabalho.

**D-90 · 15/10/2026 · Pacote padrão por tipo de organização; secretaria sem estrutura de prefeitura (pedido do usuário)**
- O usuário: "não faz sentido a gente ter uma estrutura de prefeitura numa secretaria". Até aqui toda organização recebia o pacote de prefeitura (0007): Lei Orgânica, PPA/LDO/LOA, receitas, despesas, obras, emendas parlamentares, saúde... A SMEDU tinha 18 seções de Transparência e 15 categorias de documentos de prefeitura, todas vazias.
- **Decisão (0022):** o provisionamento lê `tipo_ente`. Secretaria recebe um pacote próprio: atos da área (sem Lei Orgânica), editais, convênios e seleções, conselhos, planos e relatórios, e a seção **Contas Públicas**, que explica que receitas, despesas, licitações, contratos e pessoal da Secretaria são publicados pela Prefeitura e leva ao site dela (`config.site_prefeitura`). Câmara, autarquia e outros seguem com o pacote de prefeitura até terem um próprio (pendência).
- Organizações que já existem trocam com `aplicar_pacote_tipo(id)`: só sai o que está vazio e sem uso; nada com documento, link, sistema ou página publicada é apagado.
- Portal: `/legislacao` vira "Legislação" (sem "municipal") e a descrição da Transparência muda para quem não é prefeitura (`ehPrefeitura`).
- Testes: 15 novos (198 no total, 0 falhas).
- **Aplicação:** pelo MCP o `apply_migration` excedeu o tempo (comandos de exclusão pedem confirmação que não aparece na sessão na nuvem). Rodar o arquivo no SQL Editor (homologação; depois produção, com aprovação). Aplicada na homologação em 15/10/2026 pelo usuário (SQL Editor). Correção junto: o objeto da organização no portal (`resolverMunicipio`) não levava `tipo_ente`.

**D-91 · 15/10/2026 · Pré-visualização de rascunho no portal (pendência do painel, aprovada pelo usuário)**
- No painel, notícias e avisos ainda não publicados ganham o botão **"Pré-visualizar no site"**. Ele gera um link temporário (`criar_previa`, 0023) e abre `/previa/<token>` no portal: a notícia com o visual do site e um aviso amarelo "Pré-visualização". Mostra a última versão **salva**.
- **Segurança:** o token é um uuid aleatório, vale 30 minutos e só abre aquele conteúdo, só no domínio da própria organização. A tabela `previas` não tem policy nem grant; as funções ficam no schema `seguranca` com invólucros em `public` (padrão da 0016). Só quem pode editar o conteúdo (`is_membro`) gera o link. A página não vai para cache (`private, no-store`, também na borda) nem para buscadores.
- O corpo da notícia virou o componente `NoticiaArtigo.astro`, usado pela página publicada e pela prévia (as duas iguais).
- Aplicada na homologação e na produção (SQL Editor, 15/10/2026); testada de ponta a ponta no painel publicado. Na prévia de conteúdo não publicado, a data vira "Ainda não publicada".
- Testes: 10 novos (208 no total, 0 falhas). Próximos módulos (páginas, serviços, eventos) seguem o mesmo molde: acrescentar a tabela no `check` de `previas` e uma função de leitura.

**D-92 · 16/10/2026 · Biblioteca de mídias no painel (pendência do painel, aprovada pelo usuário)**
- O campo de imagem (`CampoImagem`), usado em notícias, eventos, banners, identidade visual, órgãos, equipe e unidades, ganhou **"Escolher da biblioteca"** (e "Trocar por uma já enviada" quando já há imagem). Abre uma janela com as imagens já enviadas pela organização, das mais recentes para as mais antigas, 24 por página, com busca pela descrição (texto alternativo) ou pelo nome do arquivo.
- Escolher reaproveita a mesma mídia (mesmo arquivo e mesmo texto alternativo); nada é copiado nem enviado de novo.
- Janela em `<dialog>` nativo (foco preso, Esc fecha), desenhada no `<body>` por portal do React, porque a busca é um formulário e não pode ficar dentro do formulário de edição. axe sem violações.
- Sem mudança no banco: a lista usa a policy existente (membros veem as mídias da própria organização).
- **16/10/2026:** a biblioteca chegou também à galeria de fotos da notícia ("Escolher da biblioteca", só cria o vínculo; recusa foto repetida) e ao editor de texto (botão "Da biblioteca"; se a mídia não tiver descrição, pede uma, que é obrigatória). Testado no painel.

**D-93 · 16/10/2026 · Pré-visualização também em páginas, serviços e eventos (amplia a D-91)**
- A 0024 estende `previas` e `criar_previa` a `paginas`, `servicos` e `eventos`, e cria `previa_conteudo(token, organização)`, que devolve `{ tabela, dados }` no formato de cada página. `/previa/<token>` mostra o tipo certo, com o mesmo aviso.
- Os corpos das páginas viraram componentes compartilhados (`PaginaArtigo`, `ServicoArtigo`, `EventoArtigo`, além do `NoticiaArtigo`), usados pela página publicada e pela prévia. Conferido: as páginas publicadas ficaram idênticas (comparação do HTML do artigo antes e depois).
- No painel, o botão "Pré-visualizar no site" aparece nos editores de notícias, páginas, serviços e eventos (conteúdo ainda não publicado).
- Testes: 10 novos (218 no total, 0 falhas).

**D-94 · 16/10/2026 · Acesso do servidor: "Meus sistemas" no painel, link no portal e VLibras (aprovado pelo usuário: "pode prosseguir")**
- **Meus sistemas (0025):** `sistemas_externos.publico` (`cidadao` ou `servidor`) e a tabela `sistema_papeis` (quais papéis veem o sistema; nenhum = todos os servidores da organização; o Administrador vê sempre). A função `meus_sistemas(organização)` devolve ao servidor logado só os dele; o painel mostra os atalhos na tela inicial. O cadastro fica no menu **Estrutura → Sistemas** (item próprio desde 16/10/2026, a pedido do usuário, que não achou a aba dentro de Transparência; a aba continua lá), com "Para quem" e os papéis. Sistemas de servidor não aparecem para o visitante do portal (policy ajustada). Testes: 9 novos (227 no total).
- **Login dos sistemas:** continua o de cada sistema (link, D-07). Login único com os satélites fica para quando eles forem construídos (no mesmo projeto Supabase) ou integrados (ver `Portais-Publicos/docs/Roteiro para Concluir.md`).
- **"Acesso do servidor" no portal:** link discreto no rodapé, para o painel do ambiente (`PAINEL_URL` no Worker; homologação já configurada; na produção, preencher quando o painel de produção for publicado). Sem a variável, o link não aparece.
- **VLibras** (especificação, seção 9; eMAG): widget oficial do Governo Federal em todas as páginas, desligável por organização (`config.modulos.vlibras = false`). No ambiente da Secke na nuvem o endereço do VLibras é bloqueado, então o carregamento foi conferido só pelo HTML; axe sem violações.

**D-95 · 16/10/2026 · Importação de redirecionamentos em lote e regra contra "pulos" de layout**
- **Importação (painel → Redirecionamentos → "Importar uma lista"):** arquivo CSV ou texto do Excel, uma linha por endereço: `endereço antigo;leva para;tipo` (tipo 301, 302 ou 410; vazio = 301). Aceita ponto e vírgula, tabulação ou vírgula, com ou sem aspas, e ignora cabeçalho e linhas com `#`. A origem é normalizada como no cadastro manual (sem domínio, minúscula, começando com `/`). Antes de gravar, a tela mostra quantas linhas estão prontas e lista as com problema (destino inválido, tipo inválido, repetida no arquivo). Endereço que já existe fica como está, a menos que se marque "trocar o destino". Grava em lotes de 500. Motivo: a migração do WordPress cria a maior parte, mas a lista de endereços antigos que a organização tem (planilha, Search Console) precisa entrar sem cadastro um a um. Testado na homologação: 301 e 410 servidos pelo portal.
- **Layout sem "pulos" (CLS):** nada pode ser escondido ou fechado por JavaScript depois da primeira pintura. O menu do celular (aberto sem JS) e os avisos já vistos ou vencidos agora são ajustados por um script curto logo após o elemento, antes de pintar. A página de serviços no celular foi de CLS 0,49 (ruim) para menos de 0,02.

**D-96 · 16/10/2026 · Cópia diária dos arquivos do Storage para o R2**
- Rotina nova `backup-arquivos.yml` (GitHub Actions, 4h de Brasília): rclone pela interface S3 do Storage do Supabase → bucket próprio no R2 (`portal-municipal-arquivos`), só o que é novo, **sem apagar nada** e com conferência de tamanho no fim.
- **Bucket separado do backup do banco** porque o do banco tem regra de expiração de 30 dias; os arquivos precisam ficar sem prazo. Sem criptografia (são os arquivos públicos do portal).
- Motivo: o backup extra (D-34) cobria só o banco; perder o projeto do Supabase perderia as fotos e os PDFs. Também serve de base para a cópia integral de fim de contrato (RF19).
- Configuração (chave S3 do Storage, bucket e token do R2) é do usuário: `docs/12-backup-e-restauracao.md`.
- **Só a produção** (ajuste do mesmo dia): a homologação tem só conteúdo de teste, com ~7,4 GB de uma organização parada (D-82); copiar isso misturaria projetos e passaria do plano grátis do R2. Em 16/10/2026 a produção ainda não tinha nenhum arquivo. Configurada pelo William no mesmo dia; a rotina copia todos os buckets do Storage (hoje `midias` e `exportacoes`, este último com as cópias integrais, por isso o bucket do R2 fica privado).

**D-97 · 16/10/2026 · Notícias das unidades (permissões, fase 1C) (pedido do usuário: "faça agora 1, 2 e 3")**
- **O que é:** uma notícia pode ser de uma unidade (escola, creche...): `publicacoes.unidade_id` (migração 0026). As permissões `conteudo.editar` e `conteudo.publicar` passam a aceitar escopo de **unidade** e de **região**. Quem tem a permissão só na unidade (ex.: diretor ou comunicação da escola) cria, edita e, se tiver "publicar", publica **só as notícias da própria unidade**. Não vê nem mexe em páginas, documentos, serviços etc.
- **Rede continua igual:** quem tem conteúdo na rede marca qualquer unidade ou nenhuma (notícia da organização). Marcar a unidade numa notícia da rede passa a deixar a equipe da unidade editá-la.
- **Regras no banco** (testadas no PGlite, 257 testes): não cria notícia de outra unidade nem sem unidade; não troca a unidade; redator da unidade não publica nem exclui; quem tem a região escreve nas unidades dela; envia imagens e monta a galeria da notícia dela; gera a prévia; "Destacar na página inicial" é decisão da rede (o valor fica como estava quando quem edita é da unidade).
- **Painel:** o nível de conteúdo (`nivel`) só vem de permissão na rede; quem só tem na unidade vê apenas "Notícias e avisos". No editor, campo "Unidade" (obrigatório e já preenchido para a escola; opcional para a rede). A lista mostra a unidade de cada notícia. **Portal:** a notícia mostra o nome da unidade.
- **Ordem obrigatória:** rodar a 0026 nos dois bancos **antes** de publicar painel e portal (as telas consultam a coluna nova).

**D-98 · 16/10/2026 · Testes automáticos do painel na SMEDU, sem senhas no código**
- As baterias (`painel/e2e/`) deixam de usar a organização parada (D-82): rodam na organização de `E2E_ORG` (padrão SMEDU), com dados que existem nela (tipos de documento, "Sobre a Secretaria", unidades) e contas próprias criadas por `e2e/preparar.mjs` (`redator.e2e`, `escola.e2e`).
- **Contas e senhas em `painel/e2e/.env.e2e`, fora do git** (modelo `.env.e2e.exemplo`). As senhas que estavam escritas nos testes saíram do código (D-25).
- A bateria de estrutura **guarda e restaura** a identidade da organização (cor e slogan); a limpeza só apaga na organização de teste. Bateria nova `escola.mjs` (fase 1C).
- Resultado em 16/10/2026: conteúdo 31, estrutura 26, administração 19, notícias 20 e escola 15 verificações, **0 falhas** (as duas últimas depois da 0026).
- Contas de teste na homologação, **a apagar antes da ida ao ar** (junto com `admin.teste` e `redator.teste`): `redator.e2e@secke.dev`, `escola2.e2e@secke.dev` e `escola.e2e@secke.dev` (esta ficou sem senha nem vínculo: o convite se perdeu quando o ambiente reiniciou), os convidados `novo.e2e.*` e os papéis "Redator (teste)" e "Comunicação da escola (teste)".
- A lista de notícias de quem só escreve na unidade mostra apenas as notícias das unidades dele (as publicadas da rede são públicas, mas não são dele para editar).

**D-99 · 16/10/2026 · Contraste de todas as cores do layout no painel**
- Identidade visual ganha a seção **"Cores do layout"** (layout vitrine): destaque escuro (contra branco), acento (contra a cor principal), fundo dos títulos (contra o texto escuro), fundo e texto do cabeçalho (um contra o outro) e as paletas dos cards de Serviços e dos blocos (texto forte sobre o claro e branco sobre o forte). Mínimo 4,5:1; salvar fica bloqueado com a lista do que ajustar. A razão aparece arredondada para baixo (4,49 aparece 4,4, não 4,5).
- A conferência achou a cor **coral** da SMEDU (blocos) em 4,49:1; trocada de `#c2412d` para `#bd3f2c` (4,66:1) na homologação.

**D-100 · 17/10/2026 · Páginas internas: coluna lateral, foto de capa e Carta de Serviços em cards (pedido do usuário: "manda bala, pode fazer")**
- **Coluna lateral** (layout vitrine) nas páginas institucionais, nos serviços e nos órgãos: "Nesta seção" (páginas irmãs/filhas, ou o grupo do menu principal em que a página está; nos órgãos, os setores), "Mais procurados" (os atalhos de serviço da página inicial) e "Atendimento" (contatos da organização e o botão do cabeçalho). No celular, vem depois do conteúdo. Motivo: no computador, metade da tela ficava vazia.
- **Foto de capa opcional** em páginas e serviços (migração 0027: `paginas.imagem_id`, `servicos.imagem_id`; a foto fica pública quando o conteúdo está publicado; a pré-visualização mostra a capa). No painel, campo "Foto de capa (opcional)", com texto alternativo obrigatório. O portal busca a capa à parte, então funciona antes e depois da migração.
- **Carta de Serviços em cards**, os mesmos da página inicial (ícone, título, uma linha, cores da paleta). Os filtros por público só aparecem para públicos com serviço; com um grupo só, sem subtítulo. Os 7 serviços da SMEDU ficaram no público "Cidadão".
- **Link do serviço** pode ser página do portal (começa com `/`): abre na mesma aba, com o botão "Acessar". Antes, o painel recusava esse formato e o portal abria em nova aba.
- **Notícia:** quando o resumo é o começo do texto, ele não se repete no topo (continua na descrição para o Google e o WhatsApp).
- **0027 aplicada pelo William nos dois bancos (17/10/2026, conferida).** Capa com proporção 16:4,2 no computador (~340 px; a primeira versão, com 450 px, empurrava o texto para baixo da dobra) e 16:9 no celular. Capas provisórias (fotos que já estavam na biblioteca): Sobre a Secretaria (vista aérea de escola, foto da Prefeitura), Área do Estudante e Matrícula Escolar (fotos livres do Em foco). Acessibilidade (axe) sem violações nas páginas novas.
- **Conteúdo provisório** (dados públicos, `legado.provisorio`): 9 perguntas frequentes, 5 leis federais de referência em "Leis e Decretos da Área" (LDB, ECA, Fundeb, PNAE, Lei 13.460, com o texto oficial do Planalto) e as competências dos 4 órgãos.

**D-101 · 17/10/2026 · Faixa cinza do topo das páginas internas mais baixa (pedido do William)**
- A faixa com migalhas, título e resumo empurrava a foto de capa para baixo. Menos espaço em cima e embaixo, traço sob o título mais perto, resumo sem limite de largura (cabe numa linha no computador) e um pouco menor; no celular, título e resumo menores.
- Medido na Área do Estudante: 235 → 159 px no computador e 262 → 181 px no celular; a foto de capa subiu 156 px no computador e 92 px no celular. Vale para todas as páginas internas.

**D-102 · 17/10/2026 · Trilha de navegação ("Início › ...") pode ser desligada; desligada na SMEDU (pedido do William)**
- A trilha no alto das páginas internas **não é exigência** (legislação, PNTP ou WCAG AA: "mostrar onde o visitante está" é o critério 2.4.8, nível AAA, e há outros meios: menu com a página atual marcada, título e a coluna lateral "Nesta seção"). É boa prática de orientação e o Google pode usá-la para mostrar o caminho no resultado.
- Nova opção por organização, `config.migalhas` (padrão: mostra). Painel → Identidade visual e dados → Navegação. Desligada, sai também o `BreadcrumbList` do JSON-LD (o Google pede que os dados estruturados descrevam o que está visível); o título ganha o respiro do alto da faixa.
- SMEDU: desligada na homologação em 17/10/2026. Outras organizações seguem com a trilha.

**D-103 · 20/10/2026 · Texto das páginas em blocos delimitados (seções em cartão), começando pela página do serviço (pedido do William)**
- O texto solto na página branca não dava sensação de organização. Na página do serviço (Carta de Serviços), cada parte vira um bloco com borda, cantos arredondados e fundo levemente tingido com a cor principal (3%): "Informações do serviço" (ficha em linhas separadas, fundo branco com sombra, botão "Acessar" dentro), "Documentos e requisitos" e "Como solicitar" (passos numerados em círculo). Título de cada bloco com o traço de acento. No celular, a ficha vira uma informação por linha. Classes `.v-bloco*` no `vitrine.css` (não confundir com `.v-secao*`, da página inicial); alto contraste coberto.
- **Texto não é justificado de propósito:** justificar abre "rios" de espaço entre palavras, que atrapalham pessoas com dislexia e baixa visão (WCAG 1.4.8 recomenda não justificar). Alinhado à esquerda é o padrão do gov.br.
- Teste na Bolsa de Estudo; se o William aprovar, levar o mesmo tratamento às páginas institucionais (`PaginaArtigo`), notícias e órgãos.

**D-104 · 20/10/2026 · Destaque compacto da página inicial 15% mais alto; brasão da Prefeitura de Paulínia preparado para a SMEDU (pedido do William)**
- **Carrossel:** `.vitrine .v-destaque-compacto` passou de `clamp(290px, 22vw, 340px)` para **`clamp(334px, 25.3vw, 391px)`** (cada limite × 1,15; ≈ 1290 × 380 px em tela larga). Vale para todo portal com cabeçalho claro (padrão do layout vitrine desde D-76). O destaque grande (cabeçalho em carrossel, D-47) não mudou.
- **Brasão:** o cabeçalho já mostra o brasão de `tema.brasao_path`, então incluí-lo é cadastro, não código (D-10). O arquivo recebido (brasão com "PAULÍNIA Prefeitura Municipal" embaixo, fundo branco, 1319 × 1192) foi recortado só no brasão, com fundo transparente, em PNG quadrado de 691 px (a assinatura em texto fica de fora: no cabeçalho ela repetiria o nome em tamanho ilegível). Na produção não há caminho para enviar arquivo pelo MCP (só SQL), e uma Edge Function de carga aberta na produção não compensa o risco; por isso o envio é pelo painel (Identidade visual e dados → Brasão), como já previsto em `docs/07`.
- **Situação encontrada na produção em 20/10/2026:** não há mais a branch `homologacao` (o usuário confirmou: "já está apenas em produção, não temos mais branch"). Na produção, a SMEDU (`paulinia-educacao`) está com `tema` vazio, sem arquivos no Storage, sem destaques e com 6 páginas. Sem banner, o destaque mostra o nome e o slogan, já com a altura nova.

**D-105 · 20/10/2026 · Sem homologação: portal e painel publicados direto na produção pela rotina "Publicar produção" (pedido do William)**
- **Situação:** a branch `homologacao` do Supabase (`kvilgamsyneenjtlllcf`) foi apagada; o usuário confirmou que agora tudo é produção ("não tem mais branch"). Os Workers de homologação ainda no ar davam erro 500 (banco inexistente), e o portal e o painel de produção nunca tinham sido publicados.
- **Banco:** as migrations 0022–0027 já estavam aplicadas na produção (tabelas, colunas e funções conferidas em 20/10), só não constavam em `supabase_migrations.schema_migrations`, provavelmente por terem sido rodadas no SQL Editor. Uma nova aplicação da 0022 pelo MCP passou do tempo (60 s) sem efeito: o conector pede confirmação para comandos destrutivos e o pedido não aparece na sessão na nuvem. Nada a reaplicar.
- **Rotina `.github/workflows/publicar-producao.yml`** (Actions → "Publicar produção"), cópia da de homologação (D-79) com conferência de que o build aponta para `qgywucdnaeheqndcxtho` e nunca para a branch antiga. Mesmos segredos `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`. Workers: `portal-municipal` e `painel-municipal` (conta `willquerubim2025.workers.dev`). O portal de produção ganhou `PAINEL_URL` no `wrangler.jsonc`.
- **Endereço provisório da SMEDU:** `portal-municipal.willquerubim2025.workers.dev` em `municipio_dominios` com `ambiente = 'homologacao'`, para ficar **fora do Google** (`noindex`) até o domínio oficial. No dia do domínio oficial: cadastrar o domínio como `producao`/principal e decidir se o provisório sai.
- A rotina "Publicar homologação" deixa de ter uso (aponta para o banco apagado); mantida até decidir se volta a existir homologação.
- **Tema da SMEDU refeito na produção (20/10/2026)**, porque estava vazio (o aprovado ficou na branch apagada), com os valores registrados em D-41, D-75, D-88 e D-102: `tema` = `layout: vitrine`, primária `#004348`, secundária `#24a9b3` (escura `#127882`), Raleway em títulos, texto e cabeçalho, `largura_topo: 1290px`; `config.cabecalho.estilo = 'claro'`, `config.home.noticias_fileira = 3`, `config.migalhas = false` e `config.home.blocos = [destaque, noticias, foco, servicos, calendario, equipe]` (ordem provisória; blocos vazios não aparecem). Conferido no navegador: destaque com 364 px a 1440 px de largura (era 317). Não refeitos, por não estarem registrados: `cor_acento`, `cores_faixa`, `cores_vivas`, o botão do cabeçalho (a página `/fale-com-o-supervisor` não existe na produção), o menu e o "Em foco".

**D-106 · 20/10/2026 · Conteúdo da SMEDU restaurado na produção a partir do backup da homologação de 19/10 (pedido do William)**
- **Motivo:** com a branch `homologacao` apagada, a produção mostrava um site bem diferente do aprovado: sem fotos, sem o "Em foco" (Bolsa e Matrícula), sem notícias, menu e páginas. O conteúdo só existia no backup do banco no R2 (`homologacao/2026-10-19`, D-34); os arquivos das fotos não (a cópia de arquivos, D-96, só cobre a produção).
- **Rotina `.github/workflows/restaurar-organizacao.yml`** (Actions → "Restaurar organização"; genérica: backup e slug são entradas). Restaura o backup num Postgres descartável e, na produção, numa transação: apaga o conteúdo da organização e grava o do backup (tema, config e as tabelas de conteúdo). Não mexe em usuários, papéis, auditoria, chamados, contratos nem domínios. Carga genérica: só as colunas que existem nos dois lados (sem as geradas), usuários inexistentes na produção viram null, autorreferências entram depois e o id da organização é trocado em tudo, inclusive nos caminhos dos arquivos (o id da SMEDU na homologação era `42795d08-…`; na produção é `3af0d4ae-…`). Sem "aplicar", a transação é desfeita e só mostra os números.
- **Teste (simulação) em 20/10:** 7 páginas, 7 serviços, 9 notícias, 4 destaques, 2 cards do "Em foco", 59 unidades, 7 eventos, 9 perguntas, 5 documentos, 4 órgãos, 10 pessoas na equipe, 12 itens de menu, 23 mídias.
- **Fotos:** buscadas na origem e enviadas ao Storage pela interface S3. Fontes: `legado.origem` (notícias, do site da Prefeitura), Portais-Publicos (brasões e as fotos do Bolsa e da Matrícula) e randomuser.me (retratos fictícios da equipe). Duas fotos de banco do Unsplash (`foco-biblioteca`, `foco-sala`) não têm origem registrada.
- **Aplicado em 20/10/2026** (rodada 3 da rotina, verde): conteúdo gravado e **21 de 23 fotos** reenviadas ao Storage. Conferido no navegador: página inicial com carrossel (Barco Escola), notícias com fotos, "Em foco" com Matrícula e Bolsa, eventos, serviços e equipe; 0 imagens quebradas.
- **Brasão:** o tema do backup de 19/10 já estava **sem** `brasao_path` (o cabeçalho antigo mostrava o brasão colorido, `docs/design/marca/brasao-colorido.png` do Portais-Publicos, mas o campo não constava no backup). Fica para o envio pelo painel (Identidade visual e dados → Brasão).
- **A pedido do usuário, "tudo, igual ao que era":** os dados fictícios (equipe, eventos e órgãos com `legado.ficticio = true`) também foram para a produção. Continuam marcados e **precisam sair antes do domínio oficial** (pendência).

**D-107 · 20/10/2026 · Brasão bem maior no cabeçalho claro (pedido do William)**
- "O brasão ficou muito pequeno... pode quase encostar na linha inferior do cabeçalho... se ultrapassar um pouco a margem de conteúdo do lado esquerdo, não tem problema." Brasão do cabeçalho claro: **118 px** a partir de 1181 px de largura (cabeçalho de 134 px, sobra ~8 px em cima e embaixo), avançando 1 rem para a esquerda da margem a partir de 1360 px; **84 px** no tablet (701 a 1180 px); no celular, os tamanhos de D-73. O cabeçalho não ficou mais alto. Sem rolagem horizontal em 390, 900, 1280, 1440 e 1920 px.
- **Descoberta:** `.marca img { width: 64px }` (global.css, do layout clássico) tem especificidade maior que `.v-cab-claro-brasao`, então **nenhum** tamanho de brasão do cabeçalho claro valia (D-57, D-63, D-73): ele sempre ficava em 64 px. A regra nova usa `.v-cab-claro .marca .v-cab-claro-brasao` e `flex: none` (o flex também o encolhia). No celular segue valendo os 64 px de fato; os 56/46 px de D-73 continuam sem efeito (pendência pequena).

**D-108 · 20/10/2026 · Moldura opcional no carrossel de destaque; na SMEDU, verde quase preto (pedido do William)**
- "Pôr uma moldura no destaque... parece que tá faltando alguma coisa... enjoado de tanto verde, mas o azul ia ficar estranho; tenta um verde bem escuro." Campo novo do tema, **`tema.moldura_destaque`** (cor; vazia = sem moldura, como antes), no painel em Identidade visual e dados, com a checagem de contraste contra o fundo branco. Borda de 8 px (5 px abaixo de 800 px de largura) com sombra suave na mesma cor; no alto contraste, amarela.
- **Ajuste no mesmo dia:** "pode manter essa cor, mas deixa ela fininha": borda de **2 px** em todas as larguras (era 8 px; 5 px no celular).
- SMEDU: `#0f2a1f` (verde quase preto, mais escuro e menos saturado que o petróleo `#004348` do cabeçalho). Testado antes na página publicada.

**D-109 · 20/10/2026 · Dias com evento do calendário em amarelo suave (pedido do William)**
- "Utiliza um tom de amarelo suave, leve, mas que dê para perceber que é amarelo... trazer um pouco mais de cor, mas sem ser grosseiro." Campo novo do tema, **`tema.cor_calendario`** (fundo dos dias com evento e da bolinha da legenda; vazio = cor da régua, como antes), no painel em Identidade visual e dados, com a checagem de contraste contra a cor principal (o número do dia). O pontinho embaixo do número passa a ser um tom mais escuro da mesma cor. Passar o mouse e o dia escolhido continuam como antes.
- SMEDU: **`#fbe7a1`**, escolhido entre três tons testados na página publicada (`#fdf0c2` sumia; `#f9df86` pesava). Contraste do número (petróleo `#004348`) sobre ele: bem acima de 4,5:1.

**D-110 · 20/10/2026 · Teste: fundo cinza médio na página inicial (pedido do William)**
- "Escolha um cinza mediano... e mude para esse cinza o fundo da página. Eu quero ver qual o efeito de uma cor mais escura na página inteira." As seções com cor própria, as fontes e o resto não mudam.
- **Descoberta:** no cabeçalho claro cada faixa da home (Notícias, Em foco, Eventos, Equipe) pinta o próprio branco (`.vitrine.v-claro .v-secao`); mudar só o `body` deixaria cinza apenas a faixa do carrossel. O "fundo da página" que se vê são essas faixas.
- Campo novo do tema, **`tema.cor_fundo_pagina`** (vazio = branco, como antes), no painel em Identidade visual e dados, com checagem de contraste contra a cor principal (títulos das seções). Vale só na página inicial (`body:has(...)`), no corpo e nas faixas brancas; mantêm a cor própria a faixa de Serviços, cards, blocos do "Em foco", calendário, avisos, cabeçalho e rodapé. No alto contraste, preto.
- SMEDU: **`#a8adb2`** (cinza médio, levemente azulado). Contraste: títulos em petróleo 4,9:1, texto escuro 6,7:1. Auditoria axe (WCAG 2.1 AA) da página inicial com o cinza: 0 problemas. É um teste: para voltar, apagar o campo no painel.
- **Descartado no mesmo dia** ("esquece o cinza, pode tirar, voltar o que era antes"): `cor_fundo_pagina` removido do tema da SMEDU; a página inicial voltou ao branco (conferido no site). O campo continua disponível no painel, vazio, para outras organizações.

**D-111 · 20/10/2026 · Barra de acessibilidade do topo em cinza escuro (pedido do William)**
- "O cabeçalho de acessibilidade, ao invés daquele verde escuro, utilize um cinza um pouco mais escuro... é só essa alteração." Campo novo do tema, **`tema.cor_barra_acessibilidade`** (texto branco; vazio = cor do cabeçalho ou a principal, como antes), no painel em Identidade visual e dados, com checagem de contraste contra o branco. Muda só a barra fina do topo (atalhos, A−/A/A+, alto contraste, "Site da Prefeitura"); o resto do cabeçalho não muda. No alto contraste, continua preta.
- SMEDU: **`#45494e`** (cinza escuro, levemente azulado); contraste do texto branco 9,1:1.
- **Descartado em 21/10/2026** ("volta ao verde... um cinza não ficou legal; altera só isso"): `cor_barra_acessibilidade` removido do tema da SMEDU; a barra voltou ao petróleo `#004348` (conferido no site). O campo continua disponível no painel, vazio.

**D-112 · 21/10/2026 · Fundo da página inicial igual ao do site da Prefeitura: `#f5f7f7` (pedido do William)**
- O pedido por trás do teste do cinza (D-110) era ter **a mesma cor de fundo do site da Prefeitura de Paulínia**. Inspecionado em www.paulinia.sp.gov.br em 21/10/2026: a área de conteúdo da página principal (`#e_conteudo`) tem fundo **`rgb(245, 247, 247)` = `#f5f7f7`**, cor chapada (sem degradê nem imagem; confirmado também pela leitura de um pixel). O cabeçalho deles é branco e o rodapé `#05474c`.
- Aplicado com o campo de D-110: `tema.cor_fundo_pagina = '#f5f7f7'` na SMEDU (página inicial: corpo e faixas brancas). As seções com cor própria não mudaram (Serviços `#f5f7f9`, cards, "Em foco", calendário). Cor do cabeçalho: a decidir depois (pedido do usuário).

**D-113 · 21/10/2026 · Em foco antes das Notícias e brasão ~30% maior (pedido do William)**
- **Ordem da página inicial da SMEDU** (`config.home.blocos`, dado): destaque, **foco**, notícias, calendário, serviços, equipe (antes: notícias antes do foco). Teste. Observado: o título "Em foco" fica colado no carrossel (a seção do foco tem pouco espaço em cima); ajustar se a ordem ficar.
- **Brasão:** "aumenta... uns 30%, mesmo que ultrapasse os limites verticais do cabeçalho, desde que mantenha o cabeçalho" do mesmo tamanho. De 118 para **154 px** (≥ 1181 px de largura) e de 84 para **110 px** (tablet), com margens negativas: a altura do cabeçalho não muda (134 px a 1440 px, medido antes e depois) e o brasão passa ~10 px para cima (sobre a barra de acessibilidade) e para baixo. No celular, sem mudança. Sem rolagem horizontal. Com a imagem atual (fundo cinza-claro, não transparente), o quadro da imagem aparece sobre a barra verde; o recorte transparente resolve.
- **Ajuste do brasão (21/10/2026):** o brasão de 154 px empurrou o menu para uma 2ª linha (cabeçalho de 134 para 178 px). Agora, a partir de 1181 px, ele avança mais sobre a margem esquerda (até 3,1 rem, nunca além da borda da tela) e fica a 6 px do nome. Medido com nova medição do script do menu: uma linha e 134 px de 1360 a 1920 px; em 1280 px o menu já ia para a 2ª linha antes (sem mudança).

**D-114 · 21/10/2026 · Brasão sem passar do topo do cabeçalho e letras do cabeçalho no verde do brasão (pedido do William)**
- "Diminua o brasão um pouquinho só, para que ele não ultrapasse o limite superior do cabeçalho": de 154 para **146 px** (≥ 1181 px), 4 px abaixo da borda de cima; continua saindo ~15 px por baixo. Tablet (110 px) também sem passar por cima. Cabeçalho com 134 px e menu numa linha (medido).
- "Altere as cores das letras do cabeçalho para a mesma cor do brasão": verde lido nas letras "PAULÍNIA" da imagem do brasão em uso, **`#028120`** (moda dos pixels; média `#037f1f`); contraste 5,0:1 sobre o branco. Campo novo do tema, **`tema.cor_letras_cabecalho`** (vazio = cor principal), no painel em Identidade visual e dados. Vale para o nome ("Prefeitura de Paulínia" / "Secretaria Municipal de Educação"), menu, submenu e lupa; o botão "Fale com a Educação" e a barra de acessibilidade não mudam; no alto contraste valem as cores dele.

**D-115 · 21/10/2026 · Brasão inteiro dentro da altura do cabeçalho (pedido do William)**
- "Diminua a dimensão do logo para que a altura dele não ultrapasse a altura do cabeçalho." Computador (≥ 1181 px): de 146 para **126 px**, com ~4 px de folga em cima e 5 px embaixo; cabeçalho continua com 134 px e menu numa linha (medido a 1440 px). Tablet: **90 px**, dentro do cabeçalho. Celular sem mudança. O avanço sobre a margem esquerda (D-113) continua.

**D-116 · 21/10/2026 · Vídeos explicativos nas páginas de serviço; dois vídeos na Matrícula Escolar da SMEDU (pedido do William)**
- "Em matrícula escolar, após a foto de destaque, coloque uma nova seção com espaço para dois vídeos: como fazer inscrição no SISS e como funciona a fila na creche. O restante deve seguir na sequência igual."
- **Genérico (D-10):** coluna nova **`servicos.videos`** (migration 0028), lista `[{titulo, caminho, capa?}]` com até 6 vídeos, arquivos no bucket público `midias`. O banco recusa vídeo ou capa fora da pasta da própria organização e vídeo sem título (CHECK com `jsonb_path_exists`, só funções nativas). Permissões: as da tabela (0008), sem GRANT novo. Testes de permissão: 262 → 267.
- **Portal:** componente `vitrine/Videos.astro`, entre a foto de capa e "Informações do serviço": título "Vídeos explicativos", aviso de que têm legenda e de que o texto está logo abaixo, vídeos lado a lado (no celular, um embaixo do outro), `preload="none"` com imagem de capa (não baixa nada antes do clique). O resto da página não muda de ordem.
- **SMEDU, Matrícula Escolar:** "Como fazer a inscrição no SISS" (1 min 19 s) e "Como funciona a fila da creche" (54 s), feitos pelo William com IA a partir dos roteiros de 21/10. São **verticais** (720 × 1280) e têm **legenda gravada**. Arquivos em `<id da SMEDU>/videos/` (6,1 MB e 3,8 MB) com capa tirada do 1º segundo. Envio ao Storage por um branch temporário (`carga-videos-smedu`, com rotina que usa a chave S3 do backup de arquivos); o branch precisa ser apagado no GitHub (a sessão não conseguiu).
- Ainda não há tela no painel para escolher os vídeos (pendência); por enquanto, cadastro pela SECKE.
- **Ajuste no mesmo dia** ("caixas separadas e com o título acima do vídeo e com maior destaque"): cada vídeo numa caixa branca própria (borda, sombra, cantos arredondados), título em cima, maior (até 1,35 rem, negrito) e com o traço de acento à esquerda; a seção deixou de ser uma caixa (sem caixa dentro de caixa) e mantém o título "Vídeos explicativos" e o aviso das legendas.

**D-117 · 21/10/2026 · Vídeos numa caixa maior, cinza-clara, com título próprio; na Matrícula, "Inscrição para creche" (pedido do William)**
- "Coloque as duas caixas, com os dois vídeos, numa caixa maior, com background tonalidade cinza e com um título geral: INSCRIÇÃO PARA CRECHE; tente manter a harmonia com as cores, fontes e títulos já utilizados na página."
- **Caixa maior:** fundo `--v-faixa-neutra` (a cor principal a 6% sobre branco, o mesmo tom da faixa do título da página), borda e cantos iguais aos dos outros blocos; as caixas de cada vídeo (D-116) continuam brancas por dentro. No alto contraste, preta com borda branca.
- **Título:** coluna nova **`servicos.videos_titulo`** (migration 0029; 1 a 80 caracteres; vazio = "Vídeos explicativos"), no mesmo estilo dos títulos de bloco ("Informações do serviço": fonte dos títulos, traço de acento, linha embaixo). Gravado em caixa normal, **"Inscrição para creche"**, para seguir os demais títulos da página (que não são em maiúsculas). Testes de permissão: 268.
- **Hierarquia:** o título geral ficou maior que o de cada vídeo (28 px contra 19 px a 1440 px). Uma publicação falhou por erro momentâneo da Cloudflare (código 10013, no envio dos arquivos) e passou ao rodar de novo; durante a troca de versão a página aparece sem estilo por alguns segundos.

**D-118 · 21/10/2026 · Texto e links ao lado dos vídeos: inscrição no SISS à esquerda, fila de espera à direita (pedido do William)**
- "No espaço vazio do lado esquerdo, coloque a descrição e o link para acessar o sistema SISS para a matrícula; do lado direito, a descrição e o link para acompanhar a fila de espera."
- **Genérico:** cada item de `servicos.videos` pode ter `apoio: {titulo, texto, links: [{rotulo, url}]}` (dado, sem migration: o CHECK da 0028 só exige título e caminho). O portal mostra o apoio do 1º vídeo à esquerda dele, o do 2º à direita (e assim por diante); o 1º link é botão, os outros, links simples; só aceita endereço `http(s)://` ou do próprio portal, e avisa "abre em nova aba". Telas médias (< 1100 px): cada par numa linha; celular: o texto fica em cima do vídeo.
- **Matrícula (SMEDU):** à esquerda, "Faça a inscrição no SISS" (documentos e formato da foto) com o botão "Fazer a inscrição no SISS" (`siss/inscricao.aspx`); à direita, "Acompanhe a fila de espera" (fila por bairro, dados pedidos na consulta, a escola liga) com o botão "Consultar a situação" (`siss/situacao.aspx`) e o link "Ver a lista de espera das creches" (página da Prefeitura). Textos com base na tela do SISS e nas Normas da Secretaria (21/10/2026), em palavras simples.

**D-119 · 21/10/2026 · Linha divisória entre os dois vídeos (pedido do William)**
- "Coloca um risco vertical separando os dois vídeos... gera duas caixinhas dentro da caixa maior. Altera só isso." Linha de 2 px (cor principal a 18% sobre branco) entre os pares vídeo + texto quando estão lado a lado; quando ficam um embaixo do outro (< 1100 px), a linha fica horizontal. Vale para qualquer serviço com vídeos e texto de apoio (D-118).

**D-120 · 21/10/2026 · Padrão da seção de vídeos: vídeo à esquerda, texto e botão à direita (pedido do William)**
- "Vamos criar um padrão para essa seção: do lado esquerdo fica o vídeo, do lado direito a descrição com o botão." Substitui a alternância de D-118 (texto do 1º à esquerda, do 2º à direita): agora todos os pares são vídeo → texto, com a linha divisória de D-119 entre eles. No celular, o texto fica embaixo do vídeo.

**D-121 · 21/10/2026 · Bloco "Sistemas" na página inicial (pedido do William)**
- "Vamos criar uma seção depois de Serviços, com o título Sistemas da Secretaria de Educação... uma série de sistemas que vão orbitar o portal." Referência enviada: faixa verde com logos em círculos brancos.
- **Genérico:** o bloco usa o cadastro que já existia (`sistemas_externos`, Central de Transparência no painel). Migração 0030: `na_home` (aparece na página inicial), `ordem`, `icone` (nome de ícone Lucide, usado quando não há logo) e `logo_id` (mídia da própria organização). Só aparecem sistemas ativos, públicos (`publico = 'cidadao'`) e com endereço `http(s)://`; abrem em nova aba, com aviso para leitor de tela. Logo de sistema público e ativo passa a ser mídia pública (`seguranca.midia_publica`). Bloco `sistemas` em `config.home.blocos`; título em `config.home.titulos.sistemas` (padrão "Sistemas").
- **Cor:** faixa na cor principal da organização (`--cor-primaria`, na SMEDU o verde-petróleo `#004348`), escurecendo em diagonal, com um brilho turquesa suave no alto. Círculos brancos (128 px; 104 px no celular) com o logo ou o ícone, nome em branco e descrição curta. Ao passar o mouse, anel na cor secundária. Assim a faixa conversa com o cabeçalho e o rodapé sem criar cor nova, e vale para qualquer organização.
- **Painel:** no formulário do sistema (Central de Transparência), grupo "Página inicial do portal" (mostrar, ordem, ícone, logo com texto alternativo obrigatório), só para sistemas do cidadão.
- **SMEDU (dados provisórios):** SISS – Educação Infantil, Transferência na Educação Infantil, Matrícula Escolar e Uniforme Escolar, com ícones; lista definitiva e logos a confirmar com a Secretaria.

**D-122 · 21/10/2026 · CI Eletrônica no bloco "Sistemas": sistemas "em breve" e de servidores na página inicial (pedido do William)**
- "Inclua a CI Eletrônica." A CI Eletrônica (repositório `ci-eletronica`, mesmo projeto Supabase, schema `ci`) é um sistema **dos servidores** e ainda **não está publicada**: não tem endereço, e o banco principal ainda não tem o schema `ci`.
- **Genérico (migração 0031):** `sistemas_externos.em_breve` (o portal mostra o cartão sem link, com a etiqueta "Em breve"; o endereço pode ficar vazio, mas só nesse caso). `na_home` passa a valer também para sistemas de servidores: o visitante vê nome, descrição e logo, com a etiqueta "Servidores" (o sistema leva à tela de entrada, que não é para o cidadão). Sistemas de servidores fora da página inicial continuam invisíveis para o visitante (RLS). Em "Meus sistemas" do painel, sistema sem endereço não aparece. Na Central de Transparência, item ligado a sistema sem endereço não aparece.
- **SMEDU:** "CI Eletrônica" (SECKE Sistemas, ícone de documento, ordem 5, em breve). Quando a CI for publicada: preencher o endereço e desmarcar "Ainda não está no ar" no painel (Central de Transparência → Sistemas).

**D-123 · 21/10/2026 · CI Eletrônica integrada ao banco de produção (pedido do William)**
- "Pode seguir... essa ferramenta faz parte da estratégia de convencimento; é importante que ela já esteja integrada, e o que faltar a gente começa a trabalhar junto com o portal." A CI (repositório `ci-eletronica`, schema `ci`) só existia no branch de homologação apagado em 20/10. Foi aplicada na produção pela versão consolidada do repositório da CI (`supabase/principal/ci_consolidado.sql`): 22 tabelas, 65 funções, 51 políticas, conferidas idênticas ao script testado; teste de ponta a ponta em transação desfeita. Detalhes nas decisões D-66 e D-67 do repositório da CI.
- **No portal:** a permissão `ci.administrar` entrou no catálogo (`painel/src/lib/permissoes.catalogo.json`), senão a sincronização a inativaria. O Administrador de cada organização a recebe ligada.
- **SMEDU:** CI ativa, uma caixa por órgão e por unidade (63), William gestor de 2 caixas para demonstração. O aplicativo é publicado no Worker `ci-eletronica` (rotina "Publicar produção" do repositório da CI). Quando estiver no ar, o cartão "CI Eletrônica" do portal (D-122) deixa de ser "Em breve" e passa a levar ao aplicativo.

**D-124 · 22/10/2026 · Tela no painel para os vídeos dos serviços (pendência de D-116)**
- **Onde:** Carta de Serviços → editar serviço → "Vídeos explicativos (opcional)", depois de "Como solicitar". Componente `painel/src/components/CampoVideos.tsx`; sem migration (usa `servicos.videos` e `servicos.videos_titulo`, 0028 e 0029).
- **O que faz:** título da seção (D-117); enviar vídeo (MP4 ou WebM, até 50 MB, até 6 por serviço, o mesmo limite do banco) com título obrigatório; **capa gerada no navegador** a partir do 1º segundo (como a da Matrícula, D-116), com "Trocar a capa" por uma imagem JPG/PNG/WebP; subir, descer e tirar do serviço; texto de apoio ao lado do vídeo (D-118/D-120: título, texto e até 3 links, o 1º vira botão).
- **Arquivos:** vídeo e capa vão pelo mesmo caminho das imagens (`enviarMidia`: `<id da organização>/<ano>/<mês>/<uuid>-<nome>` e uma linha em `midias`), então passam no CHECK da 0028. A capa entra na biblioteca de mídias; o vídeo não (a biblioteca só lista imagens). Tirar um vídeo do serviço não apaga o arquivo do Storage.
- **Validação no painel:** título de cada vídeo; link de apoio só com `https://`, `http://` ou `/` (a mesma regra do portal); título da seção até 80 caracteres. Ao gravar, tira espaços, links vazios e apoio vazio; campos que o painel não conhece (ex.: os da carga da Matrícula) são mantidos.
- **Teste (22/10/2026):** Playwright com o Supabase simulado (a rede da sessão bloqueia o Supabase) e um serviço igual ao da Matrícula: 17 verificações ok (carga dos 2 vídeos e do apoio, ordem, envio do vídeo e da capa na pasta da organização, recusa de link inválido, gravação, campos desconhecidos mantidos), axe sem violações, sem erros no navegador, o campo cabe em 390 px. `tsc` e build ok. Painel de produção publicado em 22/10/2026 (rotina "Publicar produção" #23, só o painel). **Falta conferir com o banco real** (a sessão não alcança o Supabase).

**D-125 · 22/10/2026 · Lista de schemas da API gravada no banco (contorno de falha do Supabase)**
- O schema `ci` foi marcado e salvo em Settings → Data API → Exposed schemas, mas a API continuou respondendo `PGRST106` ("só public e graphql_public"), mesmo depois de `notify pgrst, 'reload config'` e de reiniciar o projeto (22/10, 05h56). A configuração salva no painel não chegou ao serviço da API.
- **Contorno (aprovado pelo William):** `alter role authenticator set pgrst.db_schemas = 'public, graphql_public, ci'` + `notify pgrst, 'reload config'` e `'reload schema'`. Funcionou na hora. Segurança inalterada: é a mesma lista do painel; quem protege os dados continua sendo o RLS e os GRANTs (conferido: visitante só usa `ci.verificar`; tabelas e demais funções da CI recusadas).
- **Regra (pedido do William):** essa configuração vale **por cima** da tela Data API. Todo schema novo precisa entrar nos dois lugares. Diante de `PGRST106`, verificar primeiro se o schema está salvo nessa lista da mesma forma que os outros. Para desfazer: `alter role authenticator reset pgrst.db_schemas;` + `notify pgrst, 'reload config';`.
- A solução definitiva fica com o suporte do Supabase (pendência).

**D-126 · 22/10/2026 · Seção "Sistemas" na largura das outras seções e círculos menores (pedido do William)**
- "Delimite a seção de sistemas para que ela fique com a mesma largura das outras seções. Diminua o diâmetro dos ícones, porque tem outros sistemas que vão precisar entrar. E também a fonte que descreve esses sistemas."
- A faixa escura deixou de ocupar a tela toda: virou uma caixa com a largura do miolo (igual às outras seções, cantos arredondados), e o fundo da seção passou a ser o da página. Círculos de 128 → 84 px (104 → 72 px no celular), ícone 52 → 36 px, nome 1,05 → 0,95 rem, descrição 0,9 → 0,8 rem, cada item 190 → 140 px: cabem 7 ou 8 sistemas numa fileira no computador.
- Novo sistema (SMEDU): **Pesquisas da Educação** ("Questionários e pesquisas da rede municipal de ensino"), em breve, ordem 6, público cidadão, ícone de conversa. Será construído em 22/10; quando estiver no ar, preencher o endereço no painel e desmarcar "Ainda não está no ar". Se for só para servidores, trocar "Para quem".

**D-127 · 22/10/2026 · Só o brasão no cabeçalho e moldura branca fina nos cards de notícia (pedido do William)**
- **Brasão:** "Retirar a parte que aparece Prefeitura Municipal, porque está repetindo... manter só o brasão, ocupando o máximo de espaço vertical sem ultrapassar a margem do cabeçalho." As imagens enviadas pelo chat chegam reduzidas (90 e 109 px); por isso o brasão foi **recortado da imagem em alta resolução que já estava no Storage** (sem "PAULÍNIA / Prefeitura Municipal", fundo transparente, 440 × 438 px) e enviado como `…/2026/10/brasao-paulinia-sem-texto.png` (cadastrado em `midias`), e `tema.brasao_path` passou a apontar para ele. Vale para cabeçalho, rodapé, ícone da aba e imagem de compartilhamento. O tamanho no cabeçalho continua o máximo da D-115 (126 px num cabeçalho de 134 px); como a imagem agora é só o brasão, ele ocupa essa altura inteira. O arquivo foi enviado pelo branch temporário `carga-brasao-smedu` (apagar no GitHub).
- **Cards de notícia:** modelo enviado (portal da Prefeitura): a foto fica dentro do card, com moldura branca de 8 px em volta (5 px no celular), cantos da foto levemente arredondados e contorno fino no card. Vale para os cards da fileira e para as duas manchetes.

**D-128 · 22/10/2026 · Brasão do cabeçalho 20% menor (pedido do William)**
- "Diminua em aproximadamente 20% o tamanho do brasão. E vamos ver como fica no cabeçalho." Computador: 126 → 100 px (sem as margens negativas, centralizado na altura do cabeçalho de 134 px). Tablet: 90 → 72 px. Celular sem mudança (64 px, D-73). Substitui o tamanho da D-115.

**D-129 · 22/10/2026 · Destaque com "arte pronta" e arte "Novo Portal da Educação" como 1º slide (pedido do William)**
- "Inclua a imagem de capa do carrossel de destaques do portal, deve ser a primeira imagem a ser mostrada, mantenha as demais." A arte enviada já traz o texto (título, frase, ícones) e tem proporção 2,5 : 1 (1983 × 793), enquanto o espaço do carrossel é 3,3 a 3,8 : 1 no computador e quase quadrado no celular. Com o comportamento normal (corte para preencher, escurecimento e título por cima), o texto da arte ficaria coberto e cortado.
- **Genérico (migração 0032):** `destaques.arte_pronta`. Banner marcado assim mostra a arte **inteira** (sem corte), sem escurecer e sem título, texto nem botão por cima; o espaço que sobra nas laterais (ou em cima e embaixo, no celular) é preenchido pela própria arte, ampliada e desfocada. O título fica só para leitores de tela; se houver link, ele vale para o banner todo. No painel (Destaques → banner): opção "Arte pronta", com a orientação de escrever o texto da arte no texto alternativo. Tamanho sugerido no painel passou para 2560 × 768.
- **SMEDU:** arte "Novo Portal da Educação de Paulínia" (`…/2026/10/novo-portal-educacao.jpg`, enviada pelo branch temporário `carga-destaque-smedu`) como banner de ordem 0, antes dos três que já existiam. Para preencher o espaço sem as faixas desfocadas, a arte ideal é 2560 × 768 com o texto longe das bordas.

**D-130 · 22/10/2026 · Arte pronta ocupa toda a área do destaque no computador (pedido do William)**
- "Era pra imagem ocupar toda a área de destaque e não deixar esses espaços laterais." No computador e no tablet (a partir de 701 px), o banner com arte pronta passa a preencher a área (corta em cima e embaixo ou nas laterais, centrado); o fundo desfocado da D-129 fica só no celular, onde o corte esconderia o texto da arte.
- **Tamanho da arte combinado:** 2580 × 740 px (3,5 : 1), JPG ~80%, com o conteúdo importante no retângulo central de 2200 × 680 px (190 px livres em cada lateral, 30 px em cima e embaixo). O espaço do destaque varia de ≈ 3,0 : 1 (tablet) a ≈ 3,8 : 1 (notebook).
- Publicado em 22/10/2026 junto com a arte nova (2000 × 574, 3,48 : 1; `…/2026/10/novo-portal-educacao-v2.jpg`, enviada pelo branch temporário `carga-destaque2-smedu`). A arte já traz nas laterais a continuação desfocada feita pela equipe de design. Ainda em 22/10, trocada pela versão com as laterais nítidas (2000 × 722, 2,77 : 1, `…/novo-portal-educacao-v3.jpg`, branch temporário `carga-destaque3-smedu`); para ela, o ponto de corte passou para 35% da altura (corta menos em cima e mais embaixo), preservando o chapéu de formatura e os ícones de baixo no notebook.

**D-131 · 22/10/2026 · Mais espaço entre o destaque e a primeira seção (pedido do William)**
- "A seção Em foco está muito próxima da área de destaque. Desce ela pelo menos 1 centímetro." O título ficava a 14 px do fim do destaque; a primeira seção depois do destaque (qualquer que seja; na SMEDU, "Em foco") ganhou 38 px a mais em cima (24 px no celular).

**D-132 · 22/10/2026 · Lista de notícias com o fundo e a moldura da página inicial (pedido do William)**
- "Igual ao que acontece na homepage, o tom do fundo da página deve ser o mesmo, e a gente deve levar aquela moldura branca em volta do card das notícias." Na página `/noticias`, o fundo passa a ser `tema.cor_fundo_pagina` (o mesmo da página inicial, D-110) e os cards ganham a moldura branca de 8 px em volta da foto (5 px no celular) e o contorno fino da D-127. A faixa das migalhas e do título, que nas páginas internas tem um tom neutro próprio, também passa a usar o tom do fundo nessa página.
