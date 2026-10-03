# Multi-prefeitura e capacidade

*Discussão de 02/10/2026: "Com meia dúzia de prefeituras acessando ao mesmo tempo, o Supabase aguenta?"*

## Conclusão
**Aguenta com folga.** O padrão "uma tabela com `municipio_id` + RLS" é o recomendado pelo Supabase para multi-cliente. O que pesa é o volume total de acessos, não o número de prefeituras.

## Estimativa de carga (exagerada de propósito)
- 6 prefeituras × 2.000 visitas/dia × 5 páginas = 60 mil páginas/dia.
- Isso dá **< 1 requisição/s** em média e ~7/s num pico de 10 vezes.
- A menor máquina do Pro aguenta centenas de consultas indexadas por segundo.
- Jeriquara tem cerca de 3 mil habitantes; o tráfego real deve ficar bem abaixo disso.

## Por que o banco quase não trabalha
- O portal público fica atrás do **cache do Cloudflare**. Uma notícia é igual para todo mundo, então o primeiro visitante gera a consulta e os demais recebem a cópia do cache.
- **PDFs e imagens também passam pelo cache.** Isso é importante porque o egress do Supabase é cobrado acima da franquia do Pro.
- O banco fica com o painel admin (poucos usuários), a busca e as rotinas noturnas.

## Limites do Supabase
| Limite | Situação |
|---|---|
| Conexões diretas (~60 na menor máquina) | O portal e o painel usam a API HTTP (PostgREST), com pool. **Nunca** conectar o Astro direto ao Postgres. |
| Egress e storage (franquia do Pro) | O cache segura a maior parte. Jeriquara tem ~8 GB e o Pro inclui 100 GB de storage. |
| Rate limit de Auth e e-mail | Afeta só o login do painel. |

As franquias exatas mudam: conferir a tabela de preços atual do Supabase antes de cada orçamento.

## Riscos de compartilhar o banco, e como mitigar
1. **Vizinho barulhento** (exportação ou migração pesada de um município no pico) → tarefas pesadas só de madrugada e em fila.
2. **Backup único** (não dá para restaurar só um município) → **export diário por município**, reaproveitando a exportação do RF19, para permitir restauração isolada.
3. **Edital exigindo banco isolado** → o mesmo schema num projeto Supabase separado para aquele cliente; só muda a URL e a chave no portal.
4. **RLS ficando lenta com o crescimento** → aplicar o padrão `(select auth.uid())` e índices em todas as colunas usadas nas policies antes da produção.

## Quando escalar
| Cenário | Ação |
|---|---|
| Até ~20 prefeituras pequenas | Um projeto Pro, máquina básica |
| Mais clientes ou uma cidade grande | Subir o tamanho da máquina (um clique, sem mudar código) |
| Muita leitura | Réplica de leitura |
| Cliente grande ou com exigência de isolamento | Projeto Supabase dedicado, com o mesmo código |
