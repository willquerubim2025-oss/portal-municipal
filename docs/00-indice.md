# Documentação do projeto

| Doc | Conteúdo |
|---|---|
| [01-requisitos-e-viabilidade](01-requisitos-e-viabilidade.md) | Resumo do Termo de Referência, viabilidade técnica e financeira, riscos |
| [02-arquitetura](02-arquitetura.md) | Stack, componentes, fluxo de requisições, ambientes |
| [03-banco-de-dados](03-banco-de-dados.md) | Schema completo, papéis, RLS, busca, storage, testes |
| [04-multiprefeitura-e-escala](04-multiprefeitura-e-escala.md) | Como várias prefeituras dividem o mesmo banco, capacidade, riscos, quando escalar |
| [05-migracao-site-atual](05-migracao-site-atual.md) | Inventário do site atual de Jeriquara (WordPress) e plano de migração |
| [06-decisoes](06-decisoes.md) | Registro de decisões (D-01, D-02...), com data e motivo |
| [07-pendencias](07-pendencias.md) | Pendências técnicas, perguntas para a reunião inicial, próximos passos |
| [08-base-generica](08-base-generica.md) | Revisão do schema como base para qualquer prefeitura (D-10): correções feitas e módulos propostos |
| [09-seo-indexacao](09-seo-indexacao.md) | SEO e indexação no Google: o que a arquitetura já resolve e o checklist do portal (D-15) |
| [11-checklist-ir-ao-ar](11-checklist-ir-ao-ar.md) | **Antes de colocar uma prefeitura no ar:** contas, infraestrutura, dados, migração, qualidade e o dia da troca (inclui itens adiados de propósito) |
| [reuniao/](reuniao/00-LEIA-PRIMEIRO.md) | **Reunião com a prefeitura:** guia, pauta e tudo o que precisa ser levantado, por assunto (onde cada informação entra e o que muda no sistema) |

## Outros arquivos do projeto
- `supabase/migrations/`: schema (fonte da verdade do banco).
- `portal/`: portal público (Astro SSR, Cloudflare Workers). Como rodar e regras em `portal/README.md`.
- `painel/`: painel administrativo (React + Vite). Como rodar, usuários de teste e regras em `painel/README.md`.
- `migracao/`: ferramenta de migração WordPress → portal (motor genérico + mapa por prefeitura). Passo a passo em `migracao/README.md`.
- `supabase/seed.sql`: cadastro inicial de Jeriquara.
- `supabase/tests/rls.test.mjs`: testes de permissão (PGlite).
- `Inventario-Site-Atual-Jeriquara.xlsx`: inventário do site atual com a coluna Destino (RM05).
- `inventario-bruto.json`: dados brutos da API do WordPress, para o script de migração.
- Requisitos originais: `Requisitos_Site_Institucional_Jeriquara.pdf`. **Salvar uma cópia em `docs/`.**
