# Painel administrativo (React + Vite)

Onde a prefeitura e a SECKE cadastram o conteúdo do portal. SPA com login obrigatório (não precisa de SEO). Mesmos padrões do GeoEscolas. Decisões: D-09, D-13, D-18.

## Rodar localmente
```bash
cd painel
cp .env.example .env    # chave publicável da homologação
npm install
npm run dev             # http://localhost:5190
```
Usuários de teste da SMEDU, **só na homologação** (senhas passadas fora do git; apagar antes da ida ao ar):
- `admin.teste@secke.dev`: Administrador
- `redator.teste@secke.dev`: papel "Redator (teste)", só `conteudo.editar`

Os testes automáticos usam contas próprias (`redator.e2e`, `escola.e2e`), criadas por `node e2e/preparar.mjs` (seção "Teste ponta a ponta").

## Publicar (D-27)
```bash
npm run deploy:homologacao   # build com .env.homologacao + Worker painel-municipal-homologacao
npm run deploy:producao      # build com .env.producao + Worker painel-municipal
```
O painel é estático: as variáveis entram no build (por isso um build por ambiente). Depois de publicar num endereço novo, cadastrar `https://<painel>/redefinir-senha` nas Redirect URLs do Auth do projeto Supabase correspondente.

## Estrutura
| Arquivo | Papel |
|---|---|
| `src/contexts/AuthContext.tsx` | **Fonte única** de sessão, prefeituras acessíveis e papel em cada uma (`useAuth()`). SECKE (`equipe_plataforma`) vê todas como admin |
| `src/components/ExigirAcesso.tsx` | **Único** lugar que decide se uma rota abre (login, prefeitura escolhida, papel mínimo) |
| `src/layouts/PainelLayout.tsx` | Topo (seletor de prefeitura, usuário, sair) e menu lateral por papel |
| `src/lib/midias.ts` | Upload para `midias/{municipio_id}/{ano}/{mes}/{uuid}-{nome}` + linha em `midias` |
| `src/components/EditorTexto.tsx` | Editor TipTap: só H2/H3, imagem exige texto alternativo, sem cores livres |
| `src/components/CampoImagem.tsx` | Imagem de destaque com texto alternativo obrigatório |
| `src/lib/edicao.ts` | `useEdicao`: lógica comum de conteúdo publicável (carregar, salvar, publicar, agendar, despublicar, excluir, validações). Cada módulo só descreve os campos |
| `src/components/Edicao.tsx` | Cabeçalho, mensagens, campo de endereço (slug), barra de ações por papel, seletor de órgão |
| `src/components/ListaConteudo.tsx` | Lista genérica: busca, filtro por situação, filtros extras (`filtro` + `chaveFiltro`), paginação |
| `src/pages/` | Conteúdo: notícias, documentos (arquivos, relações, vigência, campos extras), páginas (hierárquicas), serviços, agenda, perguntas frequentes, banners e alertas |
| `src/pages/admin/` | Administração: usuários (convite pela Edge Function `convidar-usuario`), chamados com saldo e relatório mensal, auditoria |
| `src/pages/estrutura/` | Estrutura (admin): órgãos, menus, transparência e sistemas externos, identidade visual e dados, redirecionamentos; categorias (publicador) |

## Regras
- O painel **só esconde** o que o usuário não pode fazer; quem garante é o banco (RLS + trigger D-09). Nunca confiar só na tela.
- Toda imagem tem texto alternativo (eMAG). Títulos dentro do texto só H2/H3.
- O endereço (slug) não muda depois que o conteúdo foi publicado (links e Google).
- "Sair" explícito não lembra a página; sessão expirada lembra (volta para onde estava após o login).
- **Texto de ajuda fica fora do `<label>`** (bloco `campo` + `<small id>` + `aria-describedby`). Dentro do rótulo, ele vira parte do nome do campo no leitor de tela.
- Módulo novo: usar `useEdicao` + `ListaConteudo` + componentes de `Edicao.tsx`, registrar em `MODULOS` (`App.tsx`) e marcar `pronto: true` no menu.

## Teste ponta a ponta (Playwright, D-98)
Rodam na **homologação**, na organização de `E2E_ORG` (padrão: a SMEDU), com o painel (`npx vite --mode homologacao --port 5190`) **e o portal** (porta 4321, `DOMINIO_DEV` da mesma organização) locais.
1. Copie `e2e/.env.e2e.exemplo` para `e2e/.env.e2e` (fora do git) e preencha as senhas. **Nenhuma senha fica no código** (D-25).
2. Uma vez: `node e2e/preparar.mjs` cria as contas `redator.e2e` (papel "Redator (teste)", conteúdo na rede) e a da escola (`E2E_ESCOLA_EMAIL`; papel "Comunicação da escola (teste)", publica só na unidade). O painel local precisa estar no ar: o link do convite volta para ele.
3. `npm run e2e` roda as baterias e limpa o que elas criaram:
- `e2e/noticias.mjs`: login, senha errada, redator salva rascunho e não publica, publicada bloqueada para o redator, imagem com texto alternativo obrigatório, publicar, galeria, retirar do site.
- `e2e/conteudo.mjs` (31): documentos (anexo, relação, vigência), página filha, serviço, agenda, pergunta, banner sem imagem recusado, aviso em faixa, permissões do redator e **conferência no portal**.
- `e2e/estrutura.mjs` (26): órgão, menu, item da Transparência, sistemas, identidade (contraste das cores principais e do layout, cor aplicada no portal e **identidade original restaurada**), categoria, redirecionamento manual e **em lote** (301 e 410 no portal), redator barrado.
- `e2e/administracao.mjs` (19): convite por Vínculos, convidado cria a senha e entra com o papel certo, suspensão do acesso, chamado com nota interna da SECKE, auditoria.
- `e2e/escola.mjs`: notícia da unidade (fase 1C, D-97): a escola só vê Notícias, a notícia já vem com a unidade, publica, a lista só tem as da unidade, o portal mostra o nome da unidade; para a rede a unidade é opcional.
- Limpeza (`e2e/limpar-homologacao.mjs`): só na homologação e **só na organização de teste**; apaga os itens "E2E", os redirecionamentos de teste e os vínculos dos convidados. Avulsa: `npm run e2e:limpar`.
- Para encontrar campos, usar o papel acessível (`getByRole('textbox' | 'combobox', { name, exact: true })`): é como o leitor de tela enxerga a tela.
