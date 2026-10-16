# Site atual de Jeriquara e migração

> **Histórico (D-82):** Jeriquara está fora do projeto. Este documento fica só como registro; não serve de instrução para a SMEDU nem para outra organização.

*Inventário coletado em 02/10/2026 pela API pública do WordPress (`/wp-json/wp/v2`), com pausa entre requisições.*
*O `robots.txt` bloqueia robôs genéricos (`User-agent: * Disallow: /`); por isso **usar a API** e não um crawler página por página.*

## Plataforma
WordPress + Elementor (tema TieLabs), servidor Apache. A API REST é pública: posts, páginas, mídias, categorias, tags e menus.

## Números
| Item | Quantidade |
|---|---|
| Posts (notícias **e** publicações oficiais) | 1.639, de 2014-11 a 2026-09; forte aumento em 2025 (352) e 2026 (280) |
| Páginas | 129, muitas duplicadas (3 "Ouvidoria", 2 "Transparência", 2 "Licitações"...) |
| Mídias pela API | 6.547 (o cabeçalho diz 7.247; ~700 provavelmente estão ligadas a conteúdo privado) |
| PDFs | 4.207 |
| Imagens | ~1.970 (jpeg, png, webp) |
| ZIP | 275 (média de ~5,5 MB, provavelmente editais de licitação) |
| Volume estimado | **~8 GB** (amostragem por HEAD; PDFs ~5,7 GB, ZIP ~1,5 GB) |
| Categorias / tags | 92 / 187 |
| Arquivos fora do ar | ~1 em 120 na amostra |

## Descobertas que afetam a migração
1. **Licitações, portarias e decretos estão cadastrados como posts**, separados por categoria (Pregão Presencial 324, Dispensa 214, Documentos Oficiais 213, Pregão Eletrônico 118...). Na migração, eles vão para **`documentos`**, não `publicacoes` (D-04).
2. **Categorias duplicadas** por maiúsculas e minúsculas ("EDUCAÇÃO"/"Educação", "SAÚDE"/"Saúde"...). É preciso montar um mapa de categoria antiga para nova, validado pelo Município.
3. **URLs simples** (`/slug-do-post/`, páginas em `/pai/filho/`). Os redirecionamentos saem automaticamente do inventário (`legado.url`).
4. **Nomes de arquivo com acento**: codificar a URL ao baixar (o primeiro script falhou nisso).
5. 3.650 links internos para PDF dentro do HTML dos posts. Ao migrar, reescrever esses links para o novo Storage.
6. "Boletim Covid 19" tem 181 posts: candidato a "arquivar".

## Integrações encontradas
| Sistema | URL |
|---|---|
| Fiorilli · Portal da Transparência | http://sppmjeriquara.dcfiorilli.com.br:8079/transparencia/ |
| Fiorilli · SIS-Web | https://sppmjeriquara.dcfiorilli.com.br:897/sis/ |
| Fiorilli · SCPI 9.0 | https://scpijeriquara.dcfiorilli.com.br:879/scpi9/ |
| FlowDocs (protocolo) | https://jeriquara.flowdocs.com.br:2053/ |
| NFS-e Nacional | https://www.nfse.gov.br/ |

Todos ficam em portas fora do padrão, então a integração com o Fiorilli será **por link**, não por API.

## Arquivos
- `Inventario-Site-Atual-Jeriquara.xlsx`: abas Resumo, Páginas, Notícias e publicações, Mídias e documentos, Categorias, Links externos. As abas de conteúdo têm "Classificação sugerida" e a coluna **Destino** (migrar/arquivar/descartar) para o Município validar (RM05).
- `inventario-bruto.json`: tudo o que a API devolveu (inclui o HTML dos posts). Reaproveitar no script de migração em vez de coletar de novo.

## Ferramenta e estado (03/10/2026)
Ferramenta em `migracao/` (D-23), mapa proposto no [reunião, item 2](reuniao/02-migracao-do-site-atual.md). Amostra de 50 notícias + 50 documentos migrada na homologação.

## Plano de migração (rascunho)
> **D-22 (03/10/2026):** a migração não espera o visual nem a validação completa. Começa com a classificação sugerida e um mapa de categorias proposto pela SECKE, na homologação; o script é repetível (chave `legado.wp_id`), e a validação do Município refina nas rodadas seguintes.

1. O Município valida a coluna Destino e o mapa de categorias (pode ser em paralelo às primeiras rodadas).
2. Script lê `inventario-bruto.json` (ou recoleta só o que mudou desde 02/10/2026).
3. Baixa os arquivos marcados "migrar" e envia para o Storage em `midias/{municipio_id}/AAAA/MM/...`, com pausa.
4. Insere em `publicacoes` / `documentos` / `paginas` com `legado = {wp_id, url}`; reescreve os links internos do HTML.
5. Gera `redirecionamentos` a partir de `legado.url`, incluindo os arquivos em `/wp-content/uploads/...`.
6. Roda o verificador de links na homologação antes da virada de DNS.
7. HTML: remover marcação do Elementor e estilos inline; manter só conteúdo semântico (D-22).
8. Rodada final incremental (só o publicado no site antigo desde a última rodada) na véspera da troca do domínio.
