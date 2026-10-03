# Arquitetura

```
Cidadão ──► Cloudflare (DNS, HTTPS, cache na borda)
              │
              ├─► Portal público · Astro SSR (Cloudflare Workers, pasta portal/)
              │      · descobre o município pelo host (municipio_por_dominio)
              │      · aplica redirecionamentos 301 antes de renderizar
              │      · lê o Supabase pela API HTTP com a chave anon (RLS = só publicado)
              │
              └─► Arquivos (PDFs, imagens) · Supabase Storage, com cache no Cloudflare

Servidor da prefeitura ──► Painel admin · React + Vite (SPA, login obrigatório)
                               └─► Supabase (Auth + RLS por papel)

SECKE ──► mesmo painel, com papel equipe_plataforma (todos os municípios)

Rotinas ──► Edge Functions + pg_cron (madrugada): verificação de links, exportação,
            export diário por município · GitHub Action: pg_dump → Cloudflare R2
```

## Componentes
| Componente | Tecnologia | Observações |
|---|---|---|
| Banco, Auth, Storage | Supabase Pro, sa-east-1 | Projeto novo e exclusivo deste produto |
| Portal público | Astro 7 SSR + `@astrojs/cloudflare` (Workers) | HTML semântico, sem JS desnecessário; cache de páginas por alguns minutos. Detalhes em `portal/README.md` (D-16) |
| Painel | React 19 + Vite + supabase-js | Pode reaproveitar padrões do GeoEscolas |
| Edge Functions | Deno, em `supabase/functions/` | `convidar-usuario` (D-21). Próximas: verificação de links, exportação, export diário por município |
| Redirecionamentos | Tabela `redirecionamentos` lida pelo middleware do Astro | 301 real; contador via `registrar_acesso_redirecionamento()` |
| Busca | Função `buscar()` no Postgres | Português, sem acento, ranking por peso (título > resumo > corpo) |
| Monitoramento | UptimeRobot ou Better Stack | Alerta por e-mail ou WhatsApp para a equipe |
| Backup extra | GitHub Action `pg_dump` → R2 | Retenção de 30 dias; testar restauração periodicamente (RNF05) |

## Ambientes
- **Produção:** `jeriquara.sp.gov.br` (e os domínios dos próximos municípios).
- **Homologação:** projeto ou branch Supabase separado + subdomínio de homologação (RNF10). O município é resolvido pela tabela `municipio_dominios` com `ambiente = 'homologacao'`.
- **Local:** `supabase/tests/rls.test.mjs` usa PGlite (Postgres em memória). Não precisa de Docker.

## Regras de cache
- Páginas públicas: cache curto na borda (minutos). Ao publicar, invalidar o cache das páginas afetadas.
- Arquivos do Storage: cache longo, porque o nome do arquivo não muda; uma nova versão ganha um caminho novo.
- O painel administrativo nunca usa cache.
