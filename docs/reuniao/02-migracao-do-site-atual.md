# 2. Migração do site atual

**Por que importa:** o Termo de Referência pede que só seja migrado o que a prefeitura validar (RM03 e RM05). A SECKE já preparou uma proposta e testou com as 100 publicações mais recentes. Falta a prefeitura confirmar os pontos abaixo para rodar a migração completa.
**Material de apoio:** planilha `Inventario-Site-Atual-Jeriquara.xlsx` (pasta raiz do projeto) e simulação completa em `migracao/relatorios/simulacao-jeriquara.md`.

---

## Como a proposta organiza o site atual (1.639 publicações)
| Vai para | Quantidade | Observação |
|---|---|---|
| **Notícias** | 475 | Organizadas em 10 temas (item 2.3) |
| **Boletins da Covid, em arquivo** | 208 | Saem da página inicial e das listas, mas o endereço antigo continua abrindo (item 2.1) |
| **Documentos** | 956 | Licitações (829), decretos, portarias, leis, chamamentos, conselhos, planos, prestação de contas |

Nos documentos, as **licitações** ficam com a modalidade registrada (Pregão Presencial, Pregão Eletrônico, Dispensa, Inexigibilidade, Tomada de Preços, Concorrência, Leilão, Intenção de Registro de Preços) e com os arquivos anexos (edital, atas, homologação…).

**Todos os endereços antigos continuam funcionando:** cada notícia, documento e arquivo do site atual redireciona para o endereço novo. Links já compartilhados e resultados do Google não quebram.

---

## 2.1 Os boletins de 2020 a 2022
- **Pergunta:** os 208 posts com título "Boletim…" publicados de 2020 a 2022 são **todos boletins da Covid**?
- **Onde será usado:** no mapa da migração (`migracao/mapas/jeriquara.json`).
- **O que muda conforme a resposta:**
  | Resposta | Efeito no sistema |
  |---|---|
  | Sim, todos da Covid | Ficam como notícias "em arquivo", na categoria Covid-19: fora da página inicial e das listas; o link continua (proposta atual) |
  | Alguns são outra coisa (ex.: "Boletim Oficial" do município) | Esses viram **documentos** numa categoria própria, como "Boletim Oficial", com busca e filtros |
  | Não precisam ser mantidos | Não migram; o endereço antigo responde "conteúdo removido" (410), o que é o correto para o Google |
- **Bloqueia?** **Sim**, para a rodada completa.
- **Resposta:** ____________________________________________

## 2.2 O que não migrar
- **Pergunta:** há conteúdo que **não** deve ir para o site novo? A planilha de inventário tem a coluna **Destino** (migrar, arquivar ou descartar) para cada página, publicação e arquivo, já com uma sugestão.
- **Quem costuma saber:** Comunicação, Gabinete, Licitações.
- **Onde será usado:** na migração. O que for "descartar" não é trazido e o endereço antigo responde "removido" (410).
- **O que muda conforme a resposta:** só o conteúdo migrado. A migração pode ser repetida quantas vezes for preciso sem duplicar nada, então dá para começar com "migrar tudo" e retirar itens depois.
- **Atenção:** documentos de licitação e atos oficiais são exigidos pela transparência. **Recomendação:** não descartar nenhum, mesmo os antigos.
- **Bloqueia?** **Sim**, para a rodada final. Se a planilha não vier, a proposta é migrar tudo.
- **Prazo combinado para devolver a planilha:** ____/____/______

## 2.3 Temas das notícias
- **Pergunta:** os temas propostos atendem? **Saúde, Educação, Assistência Social, Agricultura e Meio Ambiente, Esporte, Cultura, Gabinete, Obras, Cursos e Capacitação, Geral.** Algum deve mudar de nome, juntar ou sair?
- **Contexto:** no site atual havia categorias repetidas ("Saúde" e "SAÚDE", "Educação" e "EDUCAÇÃO"), que foram unificadas. Notícias sem tema recebem o tema pelo começo do título ("Saúde Pública: …" vai para Saúde).
- **Onde será usado:** filtros da página de notícias no portal e categorias no painel.
- **O que muda conforme a resposta:** só o mapa da migração. Os temas também podem ser criados ou renomeados depois, pelo painel (Estrutura → Categorias).
- **Bloqueia?** Não.
- **Resposta:** ____________________________________________

## 2.4 Páginas do site atual
- **Pergunta:** das **129 páginas** do site atual, quais devem continuar? Há duplicadas (3 páginas "Ouvidoria", 2 "Transparência", 2 "Licitações"…). Algumas serão substituídas por partes novas do portal (Central de Transparência, Carta de Serviços, Estrutura organizacional, Legislação).
- **Onde será usado:** na etapa de migração das páginas, que é separada da de notícias e documentos.
- **O que muda conforme a resposta:**
  - página mantida → migrada e redirecionada;
  - página substituída por parte nova → o endereço antigo redireciona para a parte nova;
  - página descartada → "removido" (410).
- **Bloqueia?** Não para notícias e documentos; sim para as páginas.
- **Resposta (ou prazo):** ____________________________________________

## 2.5 Vigência das leis e decretos antigos
- **Pergunta:** a prefeitura consegue indicar quais leis e decretos estão **revogados** ou **alterados**?
- **Contexto:** o site atual não tem essa informação. O portal novo tem uma página de **Legislação** com filtro por situação (vigente, alterada, revogada) e mostra "esta lei revoga a Lei nº…".
- **Onde será usado:** nos documentos migrados (campo Situação de vigência e Atos relacionados), pelo painel.
- **O que muda conforme a resposta:** nada estrutural. Sem a informação, os atos migrados ficam com a situação "—", e a prefeitura completa aos poucos pelo painel.
- **Bloqueia?** Não.
- **Resposta:** ____________________________________________

## 2.6 Descrição das imagens (acessibilidade)
- **Informar à prefeitura:** o site atual não tem descrição nas imagens (texto alternativo, usado por quem tem deficiência visual). Na migração, as imagens recebem uma descrição automática ("Imagem: título da notícia"), marcada para revisão. Revisar é opcional e pode ser feito aos poucos pelo painel. As imagens novas exigem descrição.
- **Bloqueia?** Não.

## 2.7 Arquivos que já não existem no site atual
- **Informar e pedir à prefeitura:** na migração completa, **445 arquivos** (PDFs de licitações, contratos, aditivos…) ligados a **173 documentos e notícias** dão "não encontrado" **no próprio site atual**. O WordPress ainda tem o registro, mas o arquivo sumiu do servidor. São quase todos de **2018 a 2022**, o que sugere perda numa troca de servidor ou hospedagem. Hoje, quem clica nesses links no site atual já não consegue abrir o documento.
- **O que precisamos:** saber se a prefeitura, ou a empresa que hospeda ou hospedou o site, tem **backup antigo da pasta de arquivos** do WordPress (`wp-content/uploads`), ou se os setores (Licitações, Compras) têm esses PDFs guardados.
- **Material para levar:** `migracao/relatorios/arquivos-ausentes-no-site-atual-jeriquara.csv`, que abre no Excel e lista data, documento, página no site atual e nome de cada arquivo.
- **O que muda conforme a resposta:**
  | Resposta | Efeito |
  |---|---|
  | Há backup ou os PDFs com os setores | Enviamos os arquivos e rodamos a migração de novo: eles entram nos documentos certos, automaticamente |
  | Não há | Os documentos ficam sem esses anexos; a prefeitura pode anexar depois pelo painel o que encontrar. Vale registrar a situação, pois é um ponto de atenção para a transparência |
- **Bloqueia?** Não.
- **Resposta:** ____________________________________________

## 2.8 Arquivos grandes (acima de 50 MB)
- **Pedir à prefeitura:** **12 arquivos** (PDFs escaneados ou assinados) passam do limite de upload e não migraram. A lista está em `migracao/relatorios/arquivos-grandes-jeriquara.csv`. Pedir que os setores **comprimam** esses PDFs (normalmente caem para menos de 10 MB) e os enviem; ou a SECKE decide aumentar o limite (D-26).
- **Bloqueia?** Não; resolver antes da migração final.
