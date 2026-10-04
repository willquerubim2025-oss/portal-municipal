# Roteiro de demonstração (15 minutos)

**Para quem:** William (SECKE), para conduzir a demonstração na reunião. Não é para entregar à prefeitura.
**Atualizado em:** 04/10/2026.

## Antes da reunião (5 minutos, no dia)
- [ ] Abrir no navegador, em abas separadas:
  1. Portal: https://portal-municipal-homologacao.portal-municipal.workers.dev
  2. Painel: https://painel-municipal-homologacao.portal-municipal.workers.dev (entrar com o **admin de teste**; a senha está no arquivo local de senhas, fora do repositório)
  3. Site atual: https://www.jeriquara.sp.gov.br
- [ ] Ter o celular à mão com o portal aberto (mostrar que é responsivo).
- [ ] Testar a internet da sala. Sem internet, levar os prints de `painel/e2e/prints/`.
- [ ] Deixar o painel na tela **Início** e o portal na **página inicial**.

**Avisar logo no começo:** "o que vocês vão ver é o ambiente de teste; o conteúdo é o do site atual, migrado; as cores e o brasão ainda são provisórios e serão os da prefeitura".

## Roteiro

| Min | O que mostrar | Onde | O que dizer |
|---|---|---|---|
| 0–2 | Página inicial no computador e no celular | Portal | Site novo, rápido, funciona no celular. Conteúdo migrado do site atual: 683 notícias e 956 documentos. |
| 2–4 | Barra do topo: **A+**, **Alto contraste**, atalhos; depois **Mapa do site** no rodapé | Portal | Acessibilidade do governo federal (eMAG), exigida no contrato. Passou na verificação automática sem nenhum problema. |
| 4–5 | Colar no navegador um endereço do site antigo, trocando o domínio pelo do portal de teste: `/assistencia-social-cras-de-jeriquara-recebe-visita-tecnica-de-monitoramento-da-drads-franca/` | Portal | Todos os endereços antigos continuam funcionando: quem tem um link salvo ou vem do Google cai na página certa. Nada se perde na troca. |
| 5–6 | **Documentos → Licitações**, filtrar por ano; abrir uma licitação com os anexos | Portal | Licitações organizadas por modalidade, com edital, atas e homologação anexados. |
| 6–8 | **Transparência**; depois, no painel, **Estrutura → PNTP**, filtrar por **Essencial** | Portal e painel | A Central organiza os links dos sistemas (Fiorilli). O painel acompanha os 96 critérios do PNTP 2026; o portal já cobre sozinho a evidência de 48. Os 12 essenciais (receitas, despesas, RGF, RREO, PPA, LDO, LOA) dependem dos links que precisamos hoje. **Sem garantia de nota**: é organização. |
| 8–11 | Criar uma notícia curta, publicar e abrir no portal | Painel → Notícias e avisos | Simples como um editor de texto. Cada pessoa tem seu login e papel (quem escreve, quem publica). Em até 1 minuto aparece no site. |
| 11–12 | **Auditoria** | Painel | Tudo o que é alterado fica registrado: quem, quando e o que mudou. Ninguém apaga. |
| 12–13 | **Links quebrados** | Painel | O sistema confere toda semana os links do site. Hoje acusa os 422 anexos antigos que **já não existem no site atual** (gancho para o item 2.7: há backup?). |
| 13–14 | **Exportar dados** | Painel | Os dados são da prefeitura: a qualquer momento ela baixa tudo em formato aberto. |
| 14–15 | **Chamados** | Painel | Canal de suporte com protocolo e histórico, que conta as solicitações do contrato. |

**Depois de criar a notícia de teste, apague-a no painel** (Notícias e avisos → abrir → Excluir), para não ficar no ambiente de teste.

## Se perguntarem
- **"Quando vai ao ar?"** Depende dos acessos ao domínio e das respostas desta reunião; pelo contrato, os 60 dias contam da entrega dos acessos e materiais (item 6.9.2). Registrar a data de cada entrega em ata.
- **"Dá para mudar as cores, o brasão e a página inicial?"** Sim, pelo painel (Identidade visual e dados); falta só o material (arquivo 05).
- **"E se o site cair?"** Backup diário fora do servidor principal, com teste de restauração automático, e monitoramento (em configuração).
- **"Os dados do Fiorilli vão para o site?"** Não: o portal aponta para os sistemas oficiais, como pede o Termo de Referência (sem cópia de dados).

## Depois da demonstração
Seguir a pauta em [00-LEIA-PRIMEIRO.md](00-LEIA-PRIMEIRO.md). Entregar o [guia de teste da homologação](08-guia-teste-homologacao.md) a quem vai avaliar.
