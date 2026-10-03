# Migração WordPress → Portal Municipal

Ferramenta **genérica** para trazer sites de prefeituras feitos em WordPress (D-22, D-23). Tudo o que é específico de uma prefeitura fica no **mapa** (`mapas/<municipio>.json`); o motor (`classificar.mjs`, `migrar.mjs`) serve para qualquer uma (D-10).

## Passo a passo
```bash
cd migracao
npm install
cp .env.example .env            # URL, chave publicável e usuário da migração (SECKE ou admin do município)
node simular.mjs ../inventario-bruto.json mapas/jeriquara.json        # não grava nada; gera relatorios/simulacao-*.md
node migrar.mjs --mapa mapas/jeriquara.json --inventario ../inventario-bruto.json --noticias 50 --documentos 50   # amostra
node migrar.mjs --mapa mapas/jeriquara.json --inventario ../inventario-bruto.json --todos                          # tudo
node migrar.mjs --mapa mapas/jeriquara.json --inventario ../inventario-bruto.json --paginas                        # páginas (D-29), depois dos posts
node limpar-orfas.mjs --mapa mapas/jeriquara.json               # simula; --aplicar apaga mídias migradas que nada usa
```
Sempre na **homologação** primeiro (D-14). O usuário da migração aparece como autor na auditoria.

## Como funciona
| Etapa | O que faz |
|---|---|
| Classificação | Cada post vira **notícia** ou **documento** (D-04). Ordem: categoria de arquivo → modalidade de licitação → categoria de documento direta → categoria genérica decidida pelo **título** → notícia, com tema pela categoria ou pelo **prefixo do título** ("Saúde Pública: …") |
| Arquivos | Anexos do post + arquivos citados no HTML. Endereço normalizado (sem miniatura `-300x200`, `https`, sem acento codificado) para não enviar o mesmo arquivo duas vezes. Caminho determinístico no Storage (`wp-<id>-<nome>`): se já existe, reaproveita sem baixar |
| HTML | Remove classes, estilos, `data-*` e wrappers; títulos viram H2/H3; links para arquivos e páginas do site antigo são reescritos para os novos endereços |
| Registros | Localizados por `legado.wp_id`: rodar de novo **atualiza**, não duplica. Notícia "em arquivo" ganha `expira_em` logo após a publicação (sai das listagens, o link continua) |
| Redirecionamentos | 301 do endereço antigo de cada post e de cada arquivo (`/wp-content/uploads/...`) para o novo |
| Relatório | `relatorios/migracao-<municipio>-<data>.json`: contagens, arquivos que falharam e erros |

## Mapa de uma prefeitura nova
Copiar `mapas/jeriquara.json` e ajustar: `municipio_slug`, `site_antigo`, `fuso`, ids das categorias do WordPress (`modalidades`, `documento_direto`, `documento_pelo_titulo`, `noticia`, `arquivo_categorias`), `titulo` (regras por título) e `noticia_por_prefixo`. Rodar `simular.mjs` até o relatório fazer sentido e validar com a prefeitura (`docs/reuniao/02-migracao-do-site-atual.md` é o modelo).

## Lições da amostra de Jeriquara (03/10/2026)
- O mesmo arquivo aparece com `http://` e `https://`: sem normalizar, 742 arquivos (1,1 GB) foram enviados em dobro na primeira rodada. Corrigido; as cópias foram removidas com `limpar-orfas.mjs`.
- PDFs escaneados e assinados podem passar do limite de upload do Supabase (50 MB): aumentar o limite antes da rodada completa.
- Segunda rodada da mesma amostra: 5 min (contra 30), 836 arquivos reaproveitados, nenhum duplicado.
- **Rodada completa (D-28):** fotos de galeria anexadas ao post e não citadas no texto precisam ir para a galeria (`publicacao_midias`); PDFs anexados a notícias, para uma lista "Arquivos" no texto. Sem isso ficam órfãos.
- **Paginação:** consultas que podem passar de 1.000 linhas precisam de `range()`. Sem isso, a limpeza de órfãs tratou anexos de licitações além do milésimo como "sem uso". **Sempre rodar `limpar-orfas.mjs` primeiro sem `--aplicar` e conferir o número.**
- Arquivos que o WordPress lista mas o servidor não tem (404) vão para `relatorios/arquivos-ausentes-*.csv` com o documento de cada um, para a prefeitura procurar em backup.

## Páginas (D-29)
A seção `paginas` do mapa decide tudo: `migrar` (página do WP → caminho novo; pais antes dos filhos), `pais` (páginas novas que agrupam), `redirecionar` (endereço antigo → destino, interno ou sistema externo), `mesmo_endereco` (já existe no portal com o mesmo caminho) e `padrao` (para onde vai o que sobrar; o relatório lista em `paginas_para_padrao`). Em geral só uma fração das páginas do WordPress tem texto próprio: as demais são duplicadas, páginas vazias de menu ou atalhos para sistemas. `dados_institucionais` preenche o rodapé só onde está vazio ou com dado de exemplo.
