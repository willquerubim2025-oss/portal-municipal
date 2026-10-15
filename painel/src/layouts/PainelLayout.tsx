import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROTULO_PAPEL } from '../lib/tipos';

// `papel`: papel antigo mínimo (conteúdo, até a fase 1B). `permissao`: permissões configuráveis (basta uma), D-38.
interface ItemMenu { rotulo: string; para: string; pronto: boolean; papel?: 'editor' | 'publicador' | 'admin'; permissao?: string[] }

// Módulos do painel. `pronto: false` aparece desabilitado até ser implementado (fases seguintes).
const GRUPOS: { titulo: string; itens: ItemMenu[] }[] = [
  { titulo: 'Conteúdo', itens: [
    { rotulo: 'Notícias e avisos', para: '/noticias', pronto: true, papel: 'editor' },
    { rotulo: 'Documentos e legislação', para: '/documentos', pronto: true, papel: 'editor' },
    { rotulo: 'Páginas', para: '/paginas', pronto: true, papel: 'editor' },
    { rotulo: 'Serviços', para: '/servicos', pronto: true, papel: 'editor' },
    { rotulo: 'Agenda', para: '/eventos', pronto: true, papel: 'editor' },
    { rotulo: 'Perguntas frequentes', para: '/perguntas', pronto: true, papel: 'editor' },
    { rotulo: 'Banners e alertas', para: '/destaques', pronto: true, papel: 'editor' },
  ]},
  { titulo: 'Rede', itens: [
    { rotulo: 'Unidades e regiões', para: '/unidades', pronto: true, permissao: ['unidades.gerenciar', 'unidades.editar'] },
    { rotulo: 'Equipe gestora', para: '/equipe', pronto: true, permissao: ['equipe.gerenciar'] },
  ]},
  { titulo: 'Estrutura', itens: [
    { rotulo: 'Estrutura organizacional', para: '/orgaos', pronto: true, papel: 'admin' },
    { rotulo: 'Menus', para: '/menus', pronto: true, papel: 'admin' },
    { rotulo: 'Transparência', para: '/transparencia', pronto: true, papel: 'admin' },
    { rotulo: 'PNTP', para: '/pntp', pronto: true, papel: 'admin' },
    { rotulo: 'Identidade visual e dados', para: '/identidade', pronto: true, papel: 'admin' },
    { rotulo: 'Categorias', para: '/categorias', pronto: true, papel: 'publicador' },
    { rotulo: 'Redirecionamentos', para: '/redirecionamentos', pronto: true, papel: 'admin' },
  ]},
  { titulo: 'Administração', itens: [
    { rotulo: 'Usuários', para: '/usuarios', pronto: true, papel: 'admin' },
    { rotulo: 'Papéis e permissões', para: '/papeis', pronto: true, permissao: ['permissoes.gerenciar'] },
    { rotulo: 'Vínculos de usuários', para: '/vinculos', pronto: true, permissao: ['usuarios.vincular', 'permissoes.gerenciar'] },
    { rotulo: 'Chamados', para: '/chamados', pronto: true, papel: 'editor' },
    { rotulo: 'Links quebrados', para: '/links', pronto: true, papel: 'publicador' },
    { rotulo: 'Auditoria', para: '/auditoria', pronto: true, papel: 'admin' },
    { rotulo: 'Exportar dados', para: '/exportar', pronto: true, papel: 'admin' },
  ]},
];

export function PainelLayout() {
  const { nome, atual, acessos, escolherMunicipio, isPlataforma, podePublicar, isAdmin, sair, pode } = useAuth();
  const navegar = useNavigate();
  const permitido = (i: ItemMenu) => i.permissao ? i.permissao.some(pode)
    : !i.papel || (i.papel === 'admin' ? isAdmin : i.papel === 'publicador' ? podePublicar : !!atual?.papel);

  return (
    <div className="painel">
      <a className="pular" href="#principal">Ir para o conteúdo</a>
      <header className="topo">
        <NavLink to="/" className="topo-marca">Painel do Portal</NavLink>
        <div className="topo-direita">
          {acessos.length > 1 ? (
            <label className="seletor-municipio">
              <span className="sr-only">Prefeitura em edição</span>
              <select value={atual?.municipio.id ?? ''} onChange={(e) => { escolherMunicipio(e.target.value); navegar('/'); }}>
                {acessos.map((a) => <option key={a.municipio.id} value={a.municipio.id}>{a.municipio.nome}</option>)}
              </select>
            </label>
          ) : <span className="topo-municipio">{atual?.municipio.nome}</span>}
          <span className="topo-usuario">
            {nome || 'Usuário'} · {isPlataforma ? 'SECKE' : atual && [atual.papel && ROTULO_PAPEL[atual.papel], ...atual.papeis].filter(Boolean).join(', ')}
          </span>
          <button type="button" className="botao-link" onClick={() => sair()}>Sair</button>
        </div>
      </header>
      <div className="corpo">
        <nav className="lateral" aria-label="Módulos do painel">
          <NavLink to="/" end className="lateral-link">Início</NavLink>
          {GRUPOS.map((g) => {
            const itens = g.itens.filter(permitido);
            if (!itens.length) return null;
            return (
              <div key={g.titulo} className="lateral-grupo">
                <h2>{g.titulo}</h2>
                <ul>
                  {itens.map((i) => (
                    <li key={i.para}>
                      {i.pronto
                        ? <NavLink to={i.para} className="lateral-link">{i.rotulo}</NavLink>
                        : <span className="lateral-link desabilitado" aria-disabled="true">{i.rotulo} <small>(em breve)</small></span>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
        <main id="principal" className="conteudo" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
