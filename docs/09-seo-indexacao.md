# SEO e indexação no Google

**Data:** 03/10/2026 · **Decisão:** D-15. Tratado **uma vez, na base**: toda prefeitura nova já nasce bem indexada, sem trabalho por cliente (D-10).

## Já resolvido pela arquitetura
- **Astro SSR (D-01):** HTML completo na resposta; o Google não precisa executar JavaScript.
- **301 reais** das URLs antigas (tabela `redirecionamentos`, RM04): preserva a relevância acumulada pelo site anterior.
- **URLs limpas e estáveis:** `noticias/slug`, `documentos/slug`, `servicos/slug`, `eventos/slug`, caminho da página.
- **HTML semântico/acessível (eMAG/WCAG):** ajuda o leitor de tela e o Google ao mesmo tempo.
- **Cache na borda (Cloudflare):** tempo de resposta baixo.

## Checklist do portal (implementar no Astro, válido para todos os municípios)

### Base técnica
- [ ] `sitemap.xml` dinâmico por município (resolvido pelo host): só conteúdo `publicado` com `publicado_em <= now()`, com `lastmod` = `atualizado_em`. Índice de sitemaps se passar de 50 mil URLs.
- [ ] `robots.txt` por host, apontando para o sitemap.
- [ ] **Domínio canônico único:** o domínio `principal` de `municipio_dominios` recebe o tráfego; os demais (ex.: `www.`) respondem 301 para ele. Toda página com `<link rel="canonical">`.
- [ ] Padrão único de barra final nas URLs (sem barra), com 301 do outro formato.
- [ ] Status HTTP corretos: 404 para o que não existe, 410 para o removido de propósito (`redirecionamentos.codigo = 410`). Nunca erro com 200.
- [ ] **Homologação nunca indexável:** domínio com `ambiente = 'homologacao'` → `X-Robots-Tag: noindex, nofollow` em todas as respostas e `robots.txt` com `Disallow: /`.
- [ ] Páginas de resultado da busca interna com `noindex` (evita páginas "vazias" no índice).
- [ ] HTTPS sempre (Cloudflare) e HSTS.

### Metadados por página
- [ ] `<title>` único: "{título} — {municipios.nome}".
- [ ] `meta description`: `resumo` / `ementa` / `descricao`, cortado em ~160 caracteres; na falta, o início do corpo sem HTML.
- [ ] Open Graph e Twitter Card: título, descrição, imagem (`imagem_destaque_id` → mídia; na falta, a imagem padrão do município), `og:locale = pt_BR`. **Prioridade:** compartilhamento no WhatsApp/Facebook é a maior fonte de tráfego de prefeituras.
- [ ] `<html lang="pt-BR">`, breadcrumb visível.

### Dados estruturados (JSON-LD, schema.org)
| Conteúdo | Tipo |
|---|---|
| Município (home, rodapé) | `GovernmentOrganization` com `name`, `address`, `telephone`, `logo` (brasão), `sameAs` (redes sociais), de `municipios.config`/`tema` |
| Notícias | `NewsArticle` (`headline`, `datePublished`, `dateModified`, `image`, `publisher`) |
| Eventos | `Event` (`startDate`, `endDate`, `location`, `eventStatus`) |
| Perguntas frequentes | `FAQPage`. O Google só exibe esse resultado enriquecido para sites governamentais e de saúde, e prefeituras se qualificam |
| Carta de Serviços | `GovernmentService` (`provider` = órgão, `serviceType`, `areaServed`) |
| Navegação | `BreadcrumbList` |
| Documentos | `Legislation` para atos normativos (`legislationIdentifier` = número/ano, `legislationDate`, `legislationLegalForce` a partir de `documentos.situacao`) |

Validar com o Rich Results Test do Google antes de cada entrega.

### Velocidade (Core Web Vitals, avaliação mobile-first)
- [ ] Imagens: redimensionamento automático, WebP/AVIF, `srcset`, `loading="lazy"` fora da primeira dobra, `width`/`height` declarados (evita CLS).
- [ ] Imagem principal da página com prioridade (LCP).
- [ ] CSS crítico enxuto, mínimo de JavaScript (Astro: ilhas só onde precisa).
- [ ] Medir com o skill `web-perf` / PageSpeed Insights a cada entrega.

### Documentos (PDF)
- Cada documento tem página HTML própria (`documentos/slug`) com título, número, ementa e arquivos. É a página que deve rankear; o PDF é anexo.
- Orientar as prefeituras: PDF com texto pesquisável (não só imagem escaneada) e nome de arquivo descritivo.

### Search Console (por município)
- [ ] Verificar o domínio no Google Search Console (registro DNS ou meta tag em `municipios.config.seo.google_site_verification`).
- [ ] Enviar o sitemap; na migração, acompanhar "Páginas" e erros de redirecionamento nas semanas seguintes à troca de domínio.
- [ ] Manter o Search Console do site antigo durante a transição, se a prefeitura tiver acesso.

## Impacto no banco (pequeno, numa migration futura)
- `midias.largura` / `midias.altura` (preenchidos pelo painel no upload): `width`/`height` nas imagens.
- `municipios.config.seo`: `google_site_verification`, `imagem_compartilhamento_padrao` (mídia), redes sociais para `sameAs`. É JSON, então não exige migration, só documentar o formato.
- Opcional, avaliar quando o painel existir: campos de título/descrição SEO personalizados por conteúdo. Hoje `titulo` + `resumo` bastam.
