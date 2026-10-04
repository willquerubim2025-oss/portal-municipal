# Banco de dados

**Fonte da verdade:** `supabase/migrations/`. Este doc explica o *porquê* e as regras; para colunas exatas, ler o SQL.
**Status (02/10/2026):** **aplicado** no projeto Supabase *Portal Municipal* (`qgywucdnaeheqndcxtho`, sa-east-1), migrations 0001–0010 + seed de Jeriquara. Testado localmente com PGlite (66 testes). Revisado como base genérica: ver [doc 08](08-base-generica.md).
**Daqui em diante, nunca editar 0001–0010: toda mudança é uma migration nova.**
**Homologação (D-14):** branch `homologacao` (`kvilgamsyneenjtlllcf`). Toda migration nova passa primeiro por ela. A branch **não** traz os dados nem o Auth da produção (o seed é aplicado à parte) e **não** tem o trigger de RLS automático (`ensure_rls`) da produção: isso não afeta nada, porque as migrations ligam o RLS de cada tabela, mas reforça a regra de sempre incluir `enable row level security` em tabela nova.

## Princípios
1. **Multi-prefeitura com banco compartilhado:** toda linha de conteúdo tem `municipio_id`, e o RLS isola um município do outro (D-03).
2. **Tudo em português:** tabelas, colunas e valores de enum.
3. **Coluna `legado jsonb`** nas tabelas de conteúdo: guarda a origem da migração (`wp_id`, URL antiga) e gera os redirecionamentos.
4. **Coluna `busca`** gerada (tsvector) em publicações, páginas, documentos e serviços.
5. **`criado_por` e `atualizado_por`** têm `auth.uid()` como valor padrão.
6. **Status** `rascunho | publicado | despublicado`. Um `CHECK` obriga `publicado_em` quando o status é `publicado`.
7. **Referências sempre dentro do mesmo município (D-11):** FKs compostas `(id, municipio_id)`; cada tabela referenciada tem `unique (id, municipio_id)`. Ao criar uma tabela nova com `municipio_id` que aponte para outra, seguir o mesmo padrão.
8. **`atualizado_por`** é mantido por trigger (`set_atualizado_por`) em todo UPDATE, não só no INSERT.

## Migrations
| Arquivo | Conteúdo | Requisitos |
|---|---|---|
| 0001_base | extensões, `f_unaccent`, enums, `municipios`, `municipio_dominios`, `equipe_plataforma`, `perfis`, `membros`, funções de autorização | RF13, RF14, RNF01 |
| 0002_conteudo | `categorias`, `midias`, `publicacoes` + `publicacao_categorias`, `paginas`, `documentos` + `documento_arquivos`, `servicos`, `menus` + `menu_itens` | RF02, RF04–06, RF12, RF15 |
| 0003_transparencia | `sistemas_externos`, `transparencia_secoes`, `transparencia_itens`, `pntp_criterios` (global), `pntp_atendimento` | RF08–11 |
| 0004_operacao | `redirecionamentos`, `auditoria` + trigger, `verificacoes_links`, `verificacao_problemas`, `exportacoes`, `contratos`, `chamados`, `chamado_mensagens`, views `saldo_solicitacoes` e `relatorio_mensal_chamados` | RF16–22 |
| 0005_rls | RLS em todas as tabelas, policies e trigger `checar_permissao_publicacao` | RF13, RNF07 |
| 0006_busca_storage | `buscar()`, bucket `midias`, policies do Storage | RF03, RF15 |
| 0008_permissoes | GRANTs explícitos por papel (anon só lê o que o portal mostra; authenticated conforme as policies); revoga o resto, inclusive TRUNCATE | D-13 |
| 0009_permissoes_service_role | GRANTs do `service_role` (Edge Functions, migração, backup) | D-13 |
| 0010_municipio_campos_admin | Trigger `checar_campos_municipio`: fora da SECKE, o UPDATE em `municipios` só altera `tema` e `config` | D-20 |
| 0012_verificacao_links | `interno.configuracao`; `verificacoes_links` ganha status, quem pediu e batimento (uma em andamento por município); `verificacao_fila` (só service_role); funções `verificacao_iniciar/proximos/registrar/concluir` (só service_role); `interno.agendar_verificacoes()` (domingo 6h UTC) e `interno.disparar_rotinas()` (a cada minuto) | RF18, D-31 |
| 0013_exportacao | Bucket privado `exportacoes` (admin do município lê a própria pasta; ninguém grava pela API); uma exportação em andamento por município; `disparar_rotinas()` passa a chamar a exportação | RF19, D-32 |
| 0014_verificacao_concluir_trava | `verificacao_concluir()` trava a verificação (FOR UPDATE): duas execuções simultâneas não duplicam os problemas | D-31 |
| 0015_pntp_2026 | `pntp_criterios` ganha matriz, código, classificação, aspectos e sugestão de evidência; carga dos 181 critérios oficiais do ciclo 2026; `pntp_atendimento.evidencia_url` | RF11, D-35 |
| 0011_cache_portal | Schema `interno` (não exposto); fila `interno.cache_pendente`; gatilhos em 22 tabelas; `interno.limpar_cache_portal()` agendada no `pg_cron` a cada minuto (envia a limpeza via `pg_net`) | D-30 |
| 0007_modulos_genericos | `orgaos`, `perguntas_frequentes`, `documento_relacoes` + `documentos.situacao`, `destaques`, `publicacao_midias`, `eventos`, `publicacoes.expira_em`, `orgao_id` em serviços/documentos/publicações, `buscar()` ampliada, `provisionar_municipio()` e `criar_municipio()` | D-10, D-12 (doc 08) |

## Tabelas, em resumo

### Base
- **municipios:** tenant. `slug`, `nome`, `uf`, `tema` (cores, logo, brasão), `config` (contatos, redes, rodapé), `ativo`.
- **municipio_dominios:** `dominio` (PK, minúsculo), `municipio_id`, `ambiente` (producao/homologacao), `principal`. O portal resolve o município por aqui.
- **equipe_plataforma:** usuários da SECKE, com acesso total.
- **perfis:** nome, e-mail e cargo do usuário (1:1 com `auth.users`).
- **membros:** (`municipio_id`, `user_id`) → `papel` (admin/publicador/editor), `ativo`. Um usuário pode servir a vários municípios.

### Conteúdo
- **categorias:** `escopo` = publicacao | documento | servico | evento | pergunta; hierárquica (`parent_id`); `slug` único por município e escopo.
- **midias:** metadados do arquivo do Storage (`storage_path` = `{municipio_id}/...`), `texto_alternativo` (obrigatório na interface para imagens; acessibilidade).
- **publicacoes:** notícias e avisos (`tipo`), `slug` único por município, `imagem_destaque_id`, `destaque`, `orgao_id`, `expira_em` (depois dessa data sai das listagens e da home, mas o link continua funcionando).
- **publicacao_midias:** galeria, com várias imagens por publicação, `legenda` e `ordem`.
- **paginas:** hierárquicas, `caminho` completo único por município (ex.: `transparencia/acesso-a-informacao`).
- **documentos:** leis, decretos, portarias, editais, **licitações** (D-04). Tipo vem da `categoria_id`; `numero`, `ano`, `data_documento`, `ementa`; campos específicos em `metadados jsonb`; `orgao_id`; `situacao` (vigente/alterado/revogado/suspenso/sem_efeito; `null` quando não é ato normativo). Concursos e processos seletivos também são documentos.
- **documento_relacoes:** "A altera/revoga/regulamenta/retifica... B", entre documentos do mesmo município. Alimenta o histórico de vigência da legislação.
- **documento_arquivos:** vários arquivos por documento (edital, anexos, ata, homologação). Cada um é uma mídia **ou** uma URL externa.
- **servicos:** Carta de Serviços (Lei 13.460): público-alvo, requisitos, etapas, prazo, custo, canal, local e horário, `orgao_id` (substituiu o texto livre `orgao_responsavel`).
- **orgaos:** estrutura organizacional (LAI art. 8º §1º I), hierárquica: gabinete, secretarias, departamentos, autarquias, conselhos. Tem competências, responsável (nome, cargo, foto, currículo), e-mail, telefone, endereço e horário. Gerenciada pelo admin.
- **perguntas_frequentes:** pergunta, resposta, categoria (`escopo = pergunta`), órgão (LAI art. 8º §1º VI).
- **eventos:** agenda da cidade e de autoridades (`tipo`), início e fim, dia inteiro, local, link de inscrição, órgão, imagem.
- **destaques:** banners rotativos e alertas da home (`tipo`, `nivel` informativo/atencao/urgente). Ficam no ar de `publicado_em` até `fim_em`; banner publicado exige imagem.
- **menus / menu_itens:** menus por `local` (principal, rodapé, atalhos, por público); o item aponta para página, categoria ou URL.

Perguntas frequentes, eventos e destaques seguem o mesmo fluxo editorial de publicações (status, D-09, auditoria, `atualizado_por`).

### Transparência
- **sistemas_externos:** Fiorilli, FlowDocs, NFS-e, Diário Oficial, e-SIC, Ouvidoria; `categoria` indica o tipo. O site só aponta para eles e nunca replica dados.
- **transparencia_secoes / transparencia_itens:** estrutura da Central. Cada item tem **exatamente um** destino: URL, página, categoria de documentos ou sistema.
- **pntp_criterios:** catálogo **global** (sem `municipio_id`), um por ciclo da matriz.
- **pntp_atendimento:** por município, o critério aponta para o item da Central, com a situação (atende, parcial etc.).

### Operação
- **redirecionamentos:** `origem` (caminho antigo) → `destino`, código 301/302/410, contador de acessos.
- **auditoria:** gravada por trigger em ~19 tabelas. Guarda quem, quando, ação, antes e depois (sem a coluna `busca`). Updates que não mudam nada não geram log.
- **verificacoes_links / verificacao_problemas:** resultado do verificador periódico (RF18).
- **exportacoes:** pedidos de exportação completa (RF19), processados por Edge Function.
- **contratos:** vigência, `limite_solicitacoes` (sem padrão; `null` = sem limite), valores.
- **chamados:** `protocolo` sequencial, tipo, status, prioridade, `solicitacoes_consumidas` (D-06).
- **chamado_mensagens:** histórico; `interna = true` é visível só para a SECKE.
- **saldo_solicitacoes** (view): limite, consumidas e saldo por contrato.
- **relatorio_mensal_chamados** (view): por mês e tipo, para o fiscal do contrato.

### Schema `interno` (não exposto pela Data API)
- **cache_pendente:** um registro por município com conteúdo alterado desde a última limpeza do cache do portal (D-30). Preenchida por `interno.marcar_cache_pendente()` (gatilho AFTER em 22 tabelas; em `redirecionamentos`, só quando muda origem, destino ou código). Esvaziada a cada minuto por `interno.limpar_cache_portal()`, que lê no Vault `portal_cache_url` e `portal_cache_segredo`; sem eles, não faz nada.
- **configuracao:** valores por projeto, não sigilosos: `supabase_url` (para o pg_cron chamar as Edge Functions) e `ambiente` (`producao` ou `homologacao`, qual domínio do portal usar). Preencher em cada projeto.
- Sem GRANT para anon/authenticated (nem `usage` no schema). Tabelas e funções novas que não devam ser chamadas pela API vão para cá. Exceção: o que a Edge Function precisa ler pela API fica em `public` com GRANT só para `service_role` (ex.: `verificacao_fila`).

## Papéis e permissões (RLS)
| Quem | Pode |
|---|---|
| **anon** (visitante) | Ler conteúdo `publicado` com `publicado_em <= now()`, menus, categorias, transparência ativa, redirecionamentos, domínios |
| **editor** | Criar e editar **rascunhos**; enviar mídias; abrir chamados. **Não** publica, despublica nem altera o que já está no ar. |
| **publicador** | Tudo do editor + publicar, despublicar, excluir conteúdo e mídia, gerenciar categorias, ver relatório de links |
| **admin** | Tudo do publicador + usuários (exceto o próprio papel), menus, Central de Transparência, redirecionamentos, PNTP, auditoria, exportação |
| **equipe_plataforma** (SECKE) | Tudo, em todos os municípios; **único** que altera status e consumo de chamados e cria municípios e contratos |
| **service_role** | Edge Functions de rotina (ignora RLS) |

Funções de autorização (`security definer`): `is_plataforma()`, `tem_papel(municipio, papeis[])`, `is_membro()`, `pode_publicar()`, `is_admin()`.

**Proteção do conteúdo publicado:** a policy de UPDATE só enxerga a linha nova. Por isso existe o trigger `checar_permissao_publicacao`, que barra o editor quando o status antigo **ou** o novo é `publicado`. Sem ele, o editor conseguiria despublicar (falha encontrada e corrigida em 02/10/2026).

## Busca
`buscar(p_municipio, p_termo, p_limite, p_offset)` faz uma busca unificada em publicações, páginas, documentos, serviços, eventos, perguntas frequentes e órgãos.
- Usa `websearch_to_tsquery('portuguese', f_unaccent(termo))`, então "saude vacinacao" encontra "Saúde... Vacinação".
- Pesos: título A, resumo/ementa B, corpo C.
- Roda como `SECURITY INVOKER`, então o RLS vale: o visitante só encontra o que está publicado.
- Retorna `caminho` relativo, que são as rotas padrão do portal: `noticias/slug`, `documentos/slug`, `servicos/slug`, `eventos/slug`, `perguntas-frequentes#id`, `estrutura-organizacional/slug` ou o caminho da página.

## Formato de `municipios.tema` e `municipios.config` (lidos pelo portal)
```jsonc
// tema
{ "cor_primaria": "#0b5a3c", "cor_secundaria": "#f2b705",   // primária escura: texto branco por cima (contraste 4,5:1)
  "brasao_path": "<municipio_id>/brasao.png", "logo_path": "..." }   // caminhos no bucket midias
// config
{ "nome_curto": "Jeriquara", "slogan": "...", "endereco": "...", "telefone": "...", "email": "...",
  "horario": "...", "cnpj": "...", "redes": { "facebook": "url", "instagram": "url" },
  "modulos": { "agenda": true, ... },                         // provisionamento
  "legislacao_categorias": ["leis-ordinarias", "decretos"],    // opcional; padrão = categorias do provisionamento
  "seo": { "google_site_verification": "...", "imagem_compartilhamento_path": "..." },
  "site_atual": "https://..." }
```
Tipos em `portal/src/lib/municipio.ts`.

## Provisionamento de município (D-10)
- **`criar_municipio(slug, nome, uf, dominio)`** (só SECKE): cria o município e o domínio e aplica o pacote padrão. Retorna o `id`.
- **`provisionar_municipio(id)`** (SECKE ou admin do município): aplica o pacote padrão. É **idempotente**: rodar de novo não duplica nem sobrescreve o que o município personalizou. Cria:
  - `config.modulos` (estrutura_organizacional, perguntas_frequentes, agenda, galeria, destaques, legislacao, carta_servicos, todos `true`). O que já existir prevalece. O portal e o painel usam isso para ligar e desligar seções;
  - ~21 categorias (Lei Orgânica, Leis, Decretos, Portarias, Licitações, Contratos, Atas, Convênios, Chamamentos, Concursos, Processos Seletivos, PPA/LDO/LOA, Prestação de Contas, mais Cidadão/Empresa/Servidor nos serviços e "Geral" em notícias, eventos e perguntas);
  - menus principal, rodapé e atalhos;
  - 6 páginas obrigatórias **em rascunho** com texto-guia: O Município, Acesso à Informação, e-SIC, Ouvidoria, Privacidade (LGPD), Acessibilidade;
  - 18 seções da Central de Transparência no modelo das dimensões do PNTP, com 16 itens apontando para as páginas e categorias acima. Os links para sistemas externos são cadastrados por município.

## Permissões (D-13)
O projeto foi criado com *Automatically expose new tables* **desligado** e *automatic RLS* **ligado**. Então:
- **Tabela nova** só fica acessível com `grant` explícito numa migration. Sem isso, a funcionalidade falha fechada ("permission denied"), sem expor dados.
- **Função nova** também nasce sem EXECUTE para anon/authenticated. Funções chamadas por policies precisam de EXECUTE para **todos os papéis que consultam a tabela** (inclusive anon).
- **Funções de trigger** não precisam de EXECUTE.
- **service_role** também precisa de GRANT (0009). Ao criar uma tabela nova, repetir o grant para ele.

**Avisos aceitos do Security Advisor (02/10/2026):**
- `is_plataforma()` e `tem_papel()` são SECURITY DEFINER executáveis por anon/authenticated via RPC. São necessárias às policies e só respondem sobre o **próprio** usuário. Melhoria futura: movê-las para um schema não exposto (pendência).
- `registrar_acesso_redirecionamento()` executável por anon: intencional (o portal registra o acesso ao servir o 301). O risco é só inflar o contador.

## Storage
- Bucket público `midias`; a primeira pasta do caminho é o `municipio_id`.
- Upload só na pasta do próprio município (`municipio_do_arquivo(name)`); exclusão só por publicador ou admin.

## Testes
`node supabase/tests/rls.test.mjs` (requer `npm i`, já tem `@electric-sql/pglite` no package.json).
O teste simula `auth.uid()` e o `storage` do Supabase, aplica todas as migrations e o seed, e verifica **98 regras**: publicação por papel, isolamento entre municípios (RLS e FKs compostas), busca, auditoria, chamados e saldo, nota interna, pastas do Storage, proteção de conteúdo publicado (arquivos e substituição no Storage), provisionamento (idempotência, só a SECKE cria município), os módulos da 0007 e as permissões explícitas da 0008, os campos do município (0010), a fila do cache (0011), a verificação de links (0012, inclusive a extração de links) e a exportação (0013). Nesse Postgres local não há `pg_cron`, `pg_net` nem Vault: a 0011 só agenda a rotina onde eles existem. O teste **não** concede nada no schema `public`: usa só os GRANTs das migrations, como no projeto real.

## Pendências do banco
Ver [07-pendencias](07-pendencias.md): export diário por município, Edge Functions de links e exportação, carga dos critérios PNTP, conferência das seções da Central com a matriz PNTP vigente.
