# Banco de dados — Portal Municipal (multi-prefeitura)

Supabase/Postgres. Cada linha de conteúdo tem `municipio_id`; o isolamento entre prefeituras é feito por RLS.

| Migration | Conteúdo | Requisitos |
|---|---|---|
| 0001_base | municípios, domínios, perfis, membros (papéis), funções de autorização | RF13, RF14, RNF01 |
| 0002_conteudo | categorias, mídias, publicações (notícias/avisos), páginas, documentos + arquivos, serviços, menus | RF02, RF04–RF06, RF12, RF15 |
| 0003_transparencia | sistemas externos (Fiorilli etc.), seções/itens da Central, critérios e mapeamento PNTP | RF08–RF11 |
| 0004_operacao | redirecionamentos 301, auditoria, verificação de links, exportações, contratos, chamados, saldo e relatório mensal | RF16–RF22 |
| 0005_rls | policies por papel + trigger que protege conteúdo publicado | RF13, RNF07 |
| 0006_busca_storage | função `buscar()` (português, sem acento) e bucket `midias/{municipio_id}/...` | RF03, RF15 |
| 0008_permissoes / 0009_permissoes_service_role | GRANTs explícitos (o projeto não expõe tabelas novas automaticamente) | D-13 |
| 0007_modulos_genericos | órgãos, perguntas frequentes, legislação com vigência, destaques, galeria, eventos, expiração; `provisionar_municipio()` e `criar_municipio()` | D-10, D-12 |

## Papéis
- **editor**: cria e edita rascunhos.
- **publicador**: + publica, despublica, exclui, gerencia categorias.
- **admin**: + usuários, menus, transparência, redirecionamentos, exportação, auditoria.
- **equipe_plataforma** (SECKE): tudo em todos os municípios; único que altera status/consumo de chamados.

## Novo município
1. `select criar_municipio('slug', 'Prefeitura de X', 'UF', 'x.uf.gov.br');`: cria o município e o domínio e aplica o pacote padrão (categorias, menus, páginas obrigatórias em rascunho, Central de Transparência no modelo PNTP).
2. Cadastrar `sistemas_externos`, `contratos`, o domínio de homologação e a identidade (`tema`, `config`).
3. Criar o primeiro admin (usuário em Auth + linha em `membros`).

## Testes
`node supabase/tests/rls.test.mjs` (requer `npm i @electric-sql/pglite`) — aplica as migrations num Postgres em memória, com `auth`/`storage` simulados, e verifica 62 regras de permissão, de isolamento entre municípios, de provisionamento, dos módulos e dos GRANTs.

## Edge Functions (`supabase/functions/`)
| Função | O que faz |
|---|---|
| `convidar-usuario` | Convida um usuário para um município: cria a conta (chave de serviço), grava o vínculo com o token do admin (RLS + auditoria) e envia o e-mail ou devolve o link de convite (D-21). Publicar primeiro na homologação, depois na produção, com o mesmo código. |

## Projeto
Supabase *Portal Municipal*, `qgywucdnaeheqndcxtho`, sa-east-1. Migrations 0001–0009 e seed aplicados em 02/10/2026. Homologação: branch `homologacao` (`kvilgamsyneenjtlllcf`): aplicar a migration nova primeiro nela, conferir e só então na produção. **Nunca editar uma migration aplicada; criar a próxima numerada.** Tabela ou função nova precisa de GRANT explícito (ver doc 03 > Permissões).
