# Reunião inicial com a Prefeitura de Jeriquara: guia

**Para quem:** William (SECKE), para conduzir a reunião. Os arquivos 01 a 06 podem ser impressos ou entregues à prefeitura.
**Atualizado em:** 04/10/2026.

## Objetivo da reunião
Sair com **tudo o que a SECKE precisa para continuar o desenvolvimento**: acessos, materiais, dados da prefeitura e decisões. E com **datas de entrega registradas** para o que não for resolvido na hora.

> **Por que as datas importam:** pelo Termo de Referência (item 6.9.2), os **60 dias de implantação começam a contar da entrega dos acessos e materiais pelo Município**, e atrasos do Município deslocam o prazo. Registre em ata o que foi entregue, o que ficou pendente e a data prometida.

## O que já está pronto (para mostrar)
Roteiro de 15 minutos em [07-roteiro-demonstracao.md](07-roteiro-demonstracao.md).
- **Portal público** em teste (homologação) com **todo o conteúdo do site atual migrado**: 683 notícias, 956 documentos (830 licitações), as páginas institucionais e 7 mil arquivos; todos os endereços antigos redirecionam.
- **Acessibilidade (eMAG):** atalhos, alto contraste, tamanho do texto, mapa do site; verificação automática de 69 páginas sem nenhum problema.
- **Painel administrativo** completo: conteúdo, estrutura organizacional, menus, transparência, **acompanhamento do PNTP 2026** (96 critérios da matriz oficial), usuários, chamados, auditoria, **links quebrados** e **exportação dos dados**.
- **Operação:** backup diário fora do servidor principal, com teste de restauração automático; site rápido com cache.

## Pauta, na ordem sugerida
| # | Assunto | Arquivo | Tempo | Bloqueia o trabalho? |
|---|---|---|---|---|
| 1 | Acessos e domínio | [01-acessos-e-dominio.md](01-acessos-e-dominio.md) | 10 min | **Sim**: sem isso não há publicação nem migração completa |
| 2 | Migração do site atual | [02-migracao-do-site-atual.md](02-migracao-do-site-atual.md) | 20 min | **Sim**: para a migração completa |
| 3 | Transparência e sistemas | [03-transparencia-e-sistemas.md](03-transparencia-e-sistemas.md) | 15 min | **Sim**: para a Central de Transparência |
| 4 | Dados e conteúdo institucional | [04-dados-e-conteudo-institucional.md](04-dados-e-conteudo-institucional.md) | 15 min | Em parte: dá para começar e completar depois |
| 5 | Identidade visual | [05-identidade-visual.md](05-identidade-visual.md) | 10 min | Não: o visual entra a qualquer momento (D-22) |
| 6 | Usuários, suporte e contrato | [06-usuarios-suporte-e-contrato.md](06-usuarios-suporte-e-contrato.md) | 15 min | Em parte: usuários para o treinamento |

**Para levar:** o [roteiro de demonstração](07-roteiro-demonstracao.md) (só para você) e o [guia de teste da homologação](08-guia-teste-homologacao.md) (impresso, para quem vai avaliar).

## Resumo de tudo o que precisa ser levantado
Use como checklist durante a reunião. **B** = bloqueia o trabalho; **I** = importante, pode vir em seguida; **D** = pode ficar para depois.

### 1. Acessos e domínio
- [ ] **B** Quem administra o domínio `jeriquara.sp.gov.br` no Registro.br e o DNS (nome, contato).
- [ ] **B** Endereço oficial: **com ou sem `www`**.
- [ ] **I** Acesso ao Google Search Console do site atual (se existir).
- [ ] **I** Acesso de administrador ao WordPress atual (para ~700 arquivos que não aparecem publicamente).
- [ ] **I** Contato de TI da prefeitura e de quem responde pelo servidor do site atual.

### 2. Migração do site atual
- [ ] **B** Os 208 "Boletins" de 2020 a 2022 são todos da Covid? (vão para o arquivo)
- [ ] **B** O que **não** migrar (coluna "Destino" da planilha de inventário).
- [ ] **I** Os 10 temas das notícias atendem?
- [ ] **I** Páginas já migradas (D-29): qual das **duas Histórias** é a oficial; departamentos ficam como páginas ou vão para a Estrutura organizacional; textos atualizados?; endereço do **webmail**.
- [ ] **D** Situação de vigência das leis e decretos antigos (vigente, revogado...).
- [ ] **I** **445 arquivos que já não existem no site atual** (2018–2022): há backup? Levar a lista `arquivos-ausentes-no-site-atual-jeriquara.csv`.
- [ ] **I** 12 PDFs acima de 50 MB: pedir versão comprimida (lista `arquivos-grandes-jeriquara.csv`).

### 3. Transparência e sistemas
- [ ] **B** Endereço (link) de cada sistema Fiorilli e de cada assunto da transparência (receitas, despesas, folha, diárias, obras...).
- [ ] **B** Onde ficam hoje o **e-SIC**, a **Ouvidoria** e o **Diário Oficial**.
- [ ] **I** Existe API do Fiorilli? (padrão: só link)
- [ ] **I** Quem responde pelo PNTP na prefeitura e qual foi a última avaliação.

### 4. Dados e conteúdo institucional
- [ ] **I** **Confirmar** endereço, telefone, e-mail, horário e CNPJ (já preenchidos com os dados da página Fale Conosco do site atual).
- [ ] **I** Redes sociais oficiais (links).
- [ ] **I** Estrutura organizacional: secretarias e departamentos, responsáveis, contatos, horários e competências.
- [ ] **I** Textos das páginas obrigatórias: Acesso à Informação, e-SIC, Ouvidoria, Privacidade (com o **encarregado de dados da LGPD**), Acessibilidade, O Município.
- [ ] **D** Lista de serviços para a Carta de Serviços (Lei 13.460).

### 5. Identidade visual
- [ ] **I** Brasão em boa qualidade (PNG com fundo transparente ou vetor).
- [ ] **I** Cores oficiais e manual de marca, se houver.
- [ ] **D** O que deve aparecer na página inicial e em que ordem.

### 6. Usuários, suporte e contrato
- [ ] **B** **Regra de contagem da "solicitação editorial"** (limite de 120 no contrato).
- [ ] **I** Quem vai usar o painel: nome, e-mail e papel de cada pessoa.
- [ ] **I** Fiscal do contrato e número do contrato.
- [ ] **I** Data e formato do treinamento.
- [ ] **I** Quem aprova a homologação (aceite) e a data prevista para a troca do site.

## Ao final da reunião
1. Ler em voz alta o que ficou pendente e a **data de entrega** de cada item.
2. Combinar o canal para envio dos materiais (e-mail ou pasta compartilhada).
3. Combinar quem da prefeitura vai **testar a homologação** e quando.
4. Depois da reunião: registrar as respostas nos docs do projeto (`docs/06-decisoes.md` e `docs/07-pendencias.md`).
