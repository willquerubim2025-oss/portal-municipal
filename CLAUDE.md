# Portal Municipal (multi-prefeitura) — SECKE Sistemas

Produto da SECKE Sistemas: site institucional para prefeituras, com um único sistema atendendo vários municípios.
**Organização em foco:** Secretaria Municipal de Educação de Paulínia (SMEDU, `paulinia-educacao`), o Portal Educação. Especificação no repositório `Portais-Publicos`.
**Jeriquara/SP está fora (D-82, 15/10/2026):** a dispensa (028/2026) não foi ganha e o site de Jeriquara não será feito. Os dados dela ficam no banco, **sem manutenção**: não testar, não conferir nem planejar nada para Jeriquara. Não apagar sem pedido.

## Norte do projeto (D-10)
**Não estamos construindo o site de uma organização, e sim uma base multi-organização (prefeituras, secretarias, câmaras e outras instituições públicas).** Banco, lógica, painel e portal devem atender a maior parte dos municípios sem mudar código. O que é específico de cada prefeitura vira dado ou configuração. Nenhuma organização define a base, nem a SMEDU. Na dúvida, preferir a solução genérica.

## Antes de trabalhar, leia
- [docs/11-checklist-ir-ao-ar.md](docs/11-checklist-ir-ao-ar.md): **conferir sempre que o assunto for publicação, troca de domínio ou migração final.** Tem itens adiados de propósito (ex.: arquivos acima de 50 MB, D-26).
- [docs/00-indice.md](docs/00-indice.md): mapa da documentação.
- [docs/06-decisoes.md](docs/06-decisoes.md): o que já foi decidido e por quê. **Não reabrir sem motivo novo.**
- [docs/07-pendencias.md](docs/07-pendencias.md): o que está em aberto e os próximos passos.

## Stack decidida
| Parte | Tecnologia |
|---|---|
| Banco, autenticação e arquivos | Supabase, projeto **Portal Municipal** (`qgywucdnaeheqndcxtho`) em **sa-east-1 (São Paulo)**, plano **Pro**, org Secke Sistemas. **Não usar** GEOESCOLAS, SigDoc nem SIGACO. Tabelas novas **não** são expostas automaticamente: toda tabela ou função nova precisa de GRANT explícito numa migration (D-13). |
| Portal público | **Astro 7 SSR no Cloudflare Workers** (pasta `portal/`, D-16), com cache na borda. **Nunca SPA**, por causa de SEO, acessibilidade e redirecionamentos 301 reais. Todo HTML vindo do banco passa por `htmlSeguro()`. |
| Painel administrativo | React 19 + Vite + TipTap (pasta `painel/`, D-18), mesmos padrões do GeoEscolas: `AuthContext` fonte única, `ExigirAcesso` único guarda de rotas. O módulo de Notícias é o molde dos demais. |
| Rotinas | Edge Functions + `pg_cron`: links quebrados, exportação, migração. Backup extra via `pg_dump` em GitHub Action para o Cloudflare R2, com retenção de 30 dias. |

## Regras do código
- **Repositório:** https://github.com/willquerubim2025-oss/portal-municipal (privado, `main`). Commitar e enviar ao concluir cada etapa. Nunca versionar `.env`, chaves ou anotações com senha (D-25).
- **Multi-prefeitura:** toda tabela de conteúdo tem `municipio_id`; o isolamento é feito por RLS. Nenhum dado de uma prefeitura no código; identidade visual fica em `municipios.tema` e `municipios.config`.
- **Migrations em `supabase/migrations/`, numeradas.** Nunca editar uma migration já aplicada em produção; criar uma nova.
- **Testes de permissão:** depois de mexer em schema ou RLS, rodar `node supabase/tests/rls.test.mjs`, que precisa terminar com 0 falhas. Toda regra nova de permissão ganha um teste.
- **Idioma:** nomes de tabelas, colunas e textos em português.

## Registro obrigatório (pedido do usuário)
Toda decisão técnica, descoberta ou consideração importante discutida em conversa **deve ser registrada nos docs na mesma sessão**, sem esperar o usuário pedir:
- decisão → `docs/06-decisoes.md` (nova entrada D-xx, com data e motivo);
- algo que ficou em aberto → `docs/07-pendencias.md`;
- algo que precisa ser perguntado ou pedido à prefeitura → arquivo do assunto em `docs/reuniao/` (formato: o que precisamos / onde será usado / o que muda conforme a resposta / bloqueia?);
- mudança de schema → `docs/03-banco-de-dados.md`;
- informação sobre o cliente ou o site atual → doc correspondente.

Ao terminar, avisar o usuário em uma linha o que foi registrado e onde.
