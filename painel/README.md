# Painel administrativo (React + Vite)

Onde a prefeitura e a SECKE cadastram o conteúdo do portal. SPA com login obrigatório (não precisa de SEO). Mesmos padrões do GeoEscolas. Decisões: D-09, D-13, D-18.

## Rodar localmente
```bash
cd painel
cp .env.example .env    # chave publicável da homologação
npm install
npm run dev             # http://localhost:5190
```
Usuários de teste **só na homologação** (senha `Teste@Homologacao2026`):
- `admin.teste@exemplo.gov.br`: admin de Jeriquara
- `editor.teste@exemplo.gov.br`: editor de Jeriquara
- `secke.teste@exemplo.gov.br`: equipe da plataforma (SECKE)

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

## Teste ponta a ponta (Playwright)
Com o painel (`npm run dev`, porta 5190) **e o portal** (porta 4321) rodando contra a homologação:
```bash
npm run e2e
```
- `e2e/noticias.mjs` (19 verificações): login, senha errada, editor salva rascunho e não publica, publicado bloqueado para o editor, imagem com texto alternativo obrigatório, publicar, galeria, despublicar.
- `e2e/estrutura.mjs` (24 verificações): órgão, menu (com menu padrão), item em seção vazia da Central, sistema externo, identidade (contraste recusado, cor aplicada no portal e restaurada), categoria, redirecionamento (301 de um salto no portal), editor barrado.
- `e2e/administracao.mjs` (25 verificações): convite, convidado cria a senha pelo link e entra com o papel certo, troca de papel, desativação, chamado com nota interna e consumo do saldo, auditoria. Usa também `secke.teste@exemplo.gov.br` (equipe da plataforma, só na homologação).
- `e2e/conteudo.mjs` (30 verificações): documentos (anexo, relação, vigência), página filha, serviço, agenda, pergunta, banner sem imagem recusado, alerta, permissões do editor e **conferência no portal** do que foi publicado.
- Os testes criam itens com "E2E" no título na homologação. Para limpar: apagar desses registros em cada tabela de conteúdo da branch.
- Para encontrar campos, usar o papel acessível (`getByRole('textbox' | 'combobox', { name, exact: true })`): é como o leitor de tela enxerga a tela.
