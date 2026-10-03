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
