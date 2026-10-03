# Revisão do schema como base genérica (D-10)

**Data:** 02/10/2026. **Escopo:** migrations 0001–0006 + seed, ainda não aplicadas em produção.
**Pergunta:** o banco atende "a maior parte das prefeituras" sem mudar código, ou está preso ao caso de Jeriquara?

**Conclusão:** a fundação está correta. Ela é multi-prefeitura, guarda a identidade em dados e reaproveita `documentos` para tipos diferentes de ato. As lacunas estão em **módulos que quase toda prefeitura tem e o TR de Jeriquara não pediu**, e em **como provisionar um município novo**.

---

## 1. Corrigido nesta revisão (já aplicado nas migrations, 34 testes ok)

| Problema | Risco | Correção |
|---|---|---|
| Referências entre tabelas não conferiam o município: o admin de A conseguia pendurar um item no menu de B, ou abrir um chamado contra o contrato de B | Conteúdo de uma prefeitura aparecendo no site de outra; consumo do saldo errado | FKs compostas `(id, municipio_id)` em todas as referências entre tabelas de conteúdo (D-11) |
| `publicacao_categorias` e `documento_arquivos` aceitavam categoria ou mídia de outro município | Idem | Policy confere o município da categoria ou mídia |
| O editor podia anexar ou remover arquivos de um documento **já publicado** | Brecha na D-09 | Filho de conteúdo publicado exige publicador ou admin |
| O editor podia **substituir o arquivo** no Storage (ex.: trocar o PDF de um edital no ar) | Brecha na D-09; integridade de documento oficial | UPDATE no Storage só para publicador ou admin |
| `storage.objects` sem policy de SELECT | Nem o admin conseguia substituir arquivos nem listar a pasta no painel | Policy "membros listam" |
| `atualizado_por` só era preenchido no INSERT | A auditoria visual ("editado por") ficava errada | Trigger `set_atualizado_por` |
| Auditoria da tabela `municipios` gravava `municipio_id` nulo | O log não aparecia para o admin | Usa `id` quando a tabela é `municipios` |
| Excluir uma página usada na Central de Transparência dava erro de CHECK confuso | Ruim no painel | `on delete restrict` explícito: a página precisa sair da Central antes |
| `contratos.limite_solicitacoes` tinha **120** como padrão (número de Jeriquara) | Regra de um cliente embutida no schema | Sem padrão; `null` = sem limite |
| Policies chamavam `auth.uid()` direto | Desempenho (recomendação do Supabase) | `(select auth.uid())` |

## 2. Lacunas para a base genérica

> **Situação em 02/10/2026:** prioridades **alta e média implementadas** na migration `0007_modulos_genericos.sql` (D-12; detalhes no doc 03). A prioridade baixa continua pendente.

Critério de prioridade: **exigência legal comum a todo município (LAI, Lei 13.460, PNTP)** > muito frequente nos portais > diferencial.

### Prioridade alta: exigido pela LAI e cobrado pelo PNTP
| Módulo | Por que é genérico | Proposta |
|---|---|---|
| **Estrutura organizacional** (secretarias, órgãos, autoridades) | LAI art. 8º §1º I: estrutura, competências, endereços, telefones, horários. O PNTP verifica | Tabela `orgaos` (hierárquica: secretaria → departamento), com responsável, contatos, horário e competências. `servicos`, `documentos` e `publicacoes` passam a referenciar o órgão, em vez do texto livre `orgao_responsavel` |
| **Perguntas frequentes** | LAI art. 8º §1º VI. O PNTP verifica | Tabela `perguntas_frequentes` (pergunta, resposta, categoria, ordem, órgão opcional) |
| **Provisionamento de município** | D-10: incluir um município deve exigir só cadastro | Função `provisionar_municipio()` que cria o pacote padrão: categorias de documentos (Leis, Decretos, Portarias, Licitações, Contratos, Concursos...), seções da Central no modelo PNTP, menus e páginas obrigatórias (LAI, e-SIC, Ouvidoria, Carta de Serviços, Privacidade/LGPD, Acessibilidade) |

### Prioridade média: presente em quase todo portal municipal
| Módulo | Proposta |
|---|---|
| **Concursos e processos seletivos** | **Sem tabela nova:** categoria de `documentos` + `metadados` + vários arquivos (edital, retificações, resultados), igual às licitações (D-04). Só entra no pacote padrão do provisionamento |
| **Legislação com vigência** | Colunas em `documentos`: `situacao` (vigente/revogado/alterado) + tabela `documento_relacoes` (altera, revoga, regulamenta). É pedido comum em portais de legislação municipal |
| **Banners e alertas da home** | Tabela `destaques` (imagem, link, período de exibição, tipo banner/alerta urgente, por exemplo da Defesa Civil). Hoje não há onde guardar isso |
| **Galeria de fotos** | Tabela `publicacao_midias` (várias imagens por notícia, com ordem). Atende galeria e álbum sem um módulo à parte |
| **Agenda e eventos** | Tabela `eventos` (início, fim, local, órgão). Cobre agenda da cidade e agenda do prefeito |
| **Expiração de conteúdo** | Coluna `expira_em` em publicações (avisos com prazo) |
| **Módulos por município** | `municipios.config.modulos` (ex.: `{"agenda": true, "diario_oficial": false}`), lido pelo portal e pelo painel para ligar ou desligar seções |

### Prioridade baixa ou futura
| Item | Observação |
|---|---|
| **Diário Oficial eletrônico próprio** | Muitos municípios pequenos publicam no próprio site, mas exige lei municipal, edições numeradas, PDF assinado e imutabilidade. É um módulo grande. Hoje fica como link em `sistemas_externos` |
| **Câmaras municipais como cliente** | O schema serve quase igual. Falta uma coluna `tipo` em `municipios` (prefeitura/câmara). É um mercado vizinho, barato de preparar |
| **Fuso horário por município** | `config.fuso_horario` para AM, MT, AC etc. As datas já são `timestamptz`; só o portal precisa ler |
| **`sistemas_externos.categoria`** | Lista fixa no CHECK. Faltam categorias comuns: saúde (agendamento), educação, compras/licitações (BLL, BNC, Licitanet), concursos, holerite. Ampliar a lista agora ou trocar por texto livre com sugestões no painel |

## 3. O que não precisa mudar
- Isolamento por `municipio_id` + RLS, papéis e o fluxo editor → publicador.
- `documentos` genérico com `metadados` (D-04). Também absorve concursos, contratos e atas.
- Central de Transparência como seções e itens configuráveis apontando para sistemas externos (D-07). Funciona com qualquer fornecedor (Fiorilli, Betha, IPM, GovBr...).
- `tema` e `config` em jsonb para a identidade visual.
- O seed de Jeriquara contém só dados, nenhuma regra.
