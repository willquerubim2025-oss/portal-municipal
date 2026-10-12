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
