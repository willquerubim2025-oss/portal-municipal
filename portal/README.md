# Portal público (Astro SSR · Cloudflare Workers)

Um único portal atende todas as prefeituras: o município é descoberto pelo domínio da requisição (`municipio_dominios`). Nada de prefeitura específica no código (D-10). Decisões: D-01, D-15, D-16.

## Rodar localmente
```bash
cd portal
cp .env.example .env    # preencha a chave publicável (homologação)
npm install
npm run dev             # http://localhost:4321
```
- `DOMINIO_DEV` define qual município o `localhost` mostra.
- No desenvolvimento o portal lê a **branch de homologação** (D-14), que tem conteúdo de exemplo marcado com `legado = {"exemplo": true}`.
- Para simular outro domínio: `curl -H "Host: educacao.paulinia.teste" localhost:4321/` (o dev server aceita `*.gov.br` e `*.teste`).

## Estrutura
| Arquivo | Papel |
|---|---|
| `src/middleware.ts` | Resolve o município pelo host; 301 para o domínio canônico e para URL sem barra final; aplica `redirecionamentos` quando a rota dá 404; `noindex` na homologação; cabeçalhos de segurança |
| `src/lib/municipio.ts` | Resolução do município (cache de 60 s por isolate), tipos de `tema`/`config`, `moduloAtivo()` |
| `src/lib/consultas.ts` | Todas as consultas ao Supabase (chave publicável; o RLS só devolve o que está publicado) |
| `src/lib/html.ts` | Sanitização do HTML do editor (`htmlSeguro`). **Todo `set:html` passa por ela** |
| `src/layouts/Base.astro` | Barra de acessibilidade (eMAG), alto contraste, menu, alertas, rodapé, SEO (title, description, canônico, Open Graph, JSON-LD) |
| `src/pages/` | Rotas: `/`, `/noticias`, `/documentos`, `/legislacao`, `/servicos`, `/eventos`, `/perguntas-frequentes`, `/estrutura-organizacional`, `/transparencia`, `/busca`, `/sitemap.xml`, `/robots.txt` e `[...caminho]` (páginas institucionais) |

## Regras
- **Não escrever o texto da tag de script (`<script`) dentro do frontmatter** (nem em comentário): o scanner de dependências do Vite procura essa tag por texto, falha, desliga a pré-otimização e o `astro dev` cai com "The file does not exist at .../deps_ssr/...". Se acontecer: parar todos os `astro dev`, apagar `node_modules/.vite` e subir **um** servidor só.
- **Página nova que mostra HTML do banco:** usar `htmlSeguro()`; nunca `set:html` direto.
- **Módulo desligado** (`config.modulos.x = false`): a rota responde 404, some do menu padrão e do sitemap.
- **Sem fontes externas** (Google Fonts etc.): desempenho e LGPD.
- Contraste mínimo 4,5:1. Cores do município em `tema.cor_primaria` / `tema.cor_secundaria`; texto sobre a cor primária é branco, então a cor precisa ser escura o bastante.

## Publicar (D-27)
```bash
npx wrangler login                                     # uma vez por máquina (conta da SECKE)
CLOUDFLARE_ENV=homologacao npx astro build && npx wrangler deploy   # homologação
npx astro build && npx wrangler deploy                              # produção
```
Variáveis `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` ficam em `wrangler.jsonc` (produção no topo, `env.homologacao`) e são lidas **em tempo de execução** (`access: 'secret'` no Astro). Não são segredo: o RLS protege os dados. `DOMINIO_DEV` só no desenvolvimento (no `.env`, que também define o banco usado pelo `astro dev`: **mantenha apontando para a homologação**).
Endereço novo de um portal (ex.: `*.workers.dev` ou domínio da prefeitura) precisa estar em `municipio_dominios`; senão o portal responde "Nenhum portal está configurado para este endereço".
