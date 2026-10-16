import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ExigirAcesso } from './components/ExigirAcesso';
import { PainelLayout } from './layouts/PainelLayout';
import { Entrar, EscolherPrefeitura, EsqueciSenha, RedefinirSenha } from './pages/Acesso';
import { Inicio } from './pages/Inicio';
import { ListaNoticias } from './pages/noticias/ListaNoticias';
import { EditarNoticia } from './pages/noticias/EditarNoticia';
import { EditarDocumento, ListaDocumentos } from './pages/documentos/Documentos';
import { EditarPagina, ListaPaginas } from './pages/paginas/Paginas';
import { EditarServico, ListaServicos } from './pages/servicos/Servicos';
import { EditarEvento, ListaEventos } from './pages/eventos/Eventos';
import { EditarPergunta, ListaPerguntas } from './pages/perguntas/Perguntas';
import { EditarDestaque, ListaDestaques } from './pages/destaques/Destaques';
import { EditarOrgao, ListaOrgaos } from './pages/estrutura/Orgaos';
import { Menus } from './pages/estrutura/Menus';
import { SistemasExternos, Transparencia } from './pages/estrutura/Transparencia';
import { Pntp } from './pages/estrutura/Pntp';
import { Identidade } from './pages/estrutura/Identidade';
import { Categorias, Redirecionamentos } from './pages/estrutura/Cadastros';
import { Usuarios } from './pages/admin/Usuarios';
import { DetalheChamado, ListaChamados, NovoChamado } from './pages/admin/Chamados';
import { Auditoria } from './pages/admin/Auditoria';
import { Links } from './pages/admin/Links';
import { Exportacao } from './pages/admin/Exportacao';
import { Papeis } from './pages/admin/Papeis';
import { Vinculos } from './pages/admin/Vinculos';
import { EditarUnidade, ListaUnidades } from './pages/estrutura/Unidades';
import { EditarEquipe, ListaEquipe } from './pages/estrutura/Equipe';

// Módulos de conteúdo com lista + edição (/x, /x/novo, /x/:id).
const MODULOS = [
  { rota: 'documentos', Lista: ListaDocumentos, Editar: EditarDocumento },
  { rota: 'paginas', Lista: ListaPaginas, Editar: EditarPagina },
  { rota: 'servicos', Lista: ListaServicos, Editar: EditarServico },
  { rota: 'eventos', Lista: ListaEventos, Editar: EditarEvento },
  { rota: 'perguntas', Lista: ListaPerguntas, Editar: EditarPergunta },
  { rota: 'destaques', Lista: ListaDestaques, Editar: EditarDestaque },
];

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/esqueci-senha" element={<EsqueciSenha />} />
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />
          <Route path="/escolher-prefeitura" element={<EscolherPrefeitura />} />
          <Route element={<ExigirAcesso />}>
            <Route element={<PainelLayout />}>
              <Route index element={<Inicio />} />
              {/* Conteúdo: papel antigo (membros) até a fase 1B (D-38). */}
              <Route element={<ExigirAcesso papelMinimo="editor" />}>
              <Route path="noticias" element={<ListaNoticias />} />
              <Route path="noticias/nova" element={<EditarNoticia key="nova" />} />
              <Route path="noticias/:id" element={<EditarNoticia />} />
              {MODULOS.flatMap(({ rota, Lista, Editar }) => [
                <Route key={rota} path={rota} element={<Lista />} />,
                <Route key={`${rota}-novo`} path={`${rota}/novo`} element={<Editar key="novo" />} />,
                <Route key={`${rota}-id`} path={`${rota}/:id`} element={<Editar />} />,
              ])}
              <Route path="chamados" element={<ListaChamados />} />
              <Route path="chamados/novo" element={<NovoChamado />} />
              <Route path="chamados/:id" element={<DetalheChamado />} />
              </Route>
              {/* Módulos com permissões configuráveis (D-38). */}
              <Route element={<ExigirAcesso permissao="permissoes.gerenciar" />}>
                <Route path="papeis" element={<Papeis />} />
              </Route>
              <Route element={<ExigirAcesso permissao={['usuarios.vincular', 'permissoes.gerenciar']} />}>
                <Route path="vinculos" element={<Vinculos />} />
              </Route>
              <Route element={<ExigirAcesso permissao={['unidades.gerenciar', 'unidades.editar']} />}>
                <Route path="unidades" element={<ListaUnidades />} />
                <Route path="unidades/:id" element={<EditarUnidade />} />
              </Route>
              <Route element={<ExigirAcesso permissao="unidades.gerenciar" />}>
                <Route path="unidades/nova" element={<EditarUnidade key="nova" />} />
              </Route>
              <Route element={<ExigirAcesso permissao="equipe.gerenciar" />}>
                <Route path="equipe" element={<ListaEquipe />} />
                <Route path="equipe/nova" element={<EditarEquipe key="nova" />} />
                <Route path="equipe/:id" element={<EditarEquipe />} />
              </Route>
              <Route element={<ExigirAcesso papelMinimo="publicador" />}>
                <Route path="categorias" element={<Categorias />} />
                <Route path="links" element={<Links />} />
              </Route>
              <Route element={<ExigirAcesso papelMinimo="admin" />}>
                <Route path="orgaos" element={<ListaOrgaos />} />
                <Route path="orgaos/novo" element={<EditarOrgao key="novo" />} />
                <Route path="orgaos/:id" element={<EditarOrgao />} />
                <Route path="menus" element={<Menus />} />
                <Route path="transparencia" element={<Transparencia />} />
                <Route path="sistemas" element={<SistemasExternos />} />
                <Route path="pntp" element={<Pntp />} />
                <Route path="identidade" element={<Identidade />} />
                <Route path="redirecionamentos" element={<Redirecionamentos />} />
                <Route path="usuarios" element={<Usuarios />} />
                <Route path="auditoria" element={<Auditoria />} />
                <Route path="exportar" element={<Exportacao />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
