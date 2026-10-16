import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { mensagemErro, supabase } from '../../lib/supabase';
import { dataHora } from '../../lib/texto';
import { EtiquetaSituacao } from '../../components/Situacao';
import type { Status } from '../../lib/tipos';
import { useUnidadesNoticia } from '../../lib/unidadesNoticia';

interface Linha { id: string; titulo: string; tipo: 'noticia' | 'aviso'; status: Status; publicado_em: string | null; atualizado_em: string; destaque: boolean; unidade: { nome: string } | null }
const POR_PAGINA = 20;

export function ListaNoticias() {
  const { atual } = useAuth();
  const [params, setParams] = useSearchParams();
  const filtro = params.get('situacao') ?? '';
  const termo = params.get('q') ?? '';
  const pagina = Math.max(1, Number(params.get('pagina')) || 1);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [total, setTotal] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState(termo);
  // Quem só escreve na unidade vê as notícias dela (as publicadas da rede são públicas, mas não são dele).
  const unidades = useUnidadesNoticia();
  const filtroUnidade = unidades.soUnidade ? unidades.opcoes.map((u) => u.id).join(',') : null;

  useEffect(() => {
    if (unidades.soUnidade && !unidades.carregado) return;
    let ativo = true;
    const agora = new Date().toISOString();
    let q = supabase.from('publicacoes')
      .select('id, titulo, tipo, status, publicado_em, atualizado_em, destaque, unidade:unidades!publicacoes_unidade_fkey(nome)', { count: 'exact' })
      .eq('municipio_id', atual!.municipio.id)
      .order('atualizado_em', { ascending: false })
      .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
    if (filtro === 'agendado') q = q.eq('status', 'publicado').gt('publicado_em', agora);
    else if (filtro === 'publicado') q = q.eq('status', 'publicado').lte('publicado_em', agora);
    else if (filtro) q = q.eq('status', filtro);
    if (filtroUnidade !== null) q = q.in('unidade_id', filtroUnidade ? filtroUnidade.split(',') : ['00000000-0000-0000-0000-000000000000']);
    if (termo) q = q.ilike('titulo', `%${termo.replace(/[%_]/g, '\\$&')}%`);
    q.then(({ data, count, error }) => {
      if (!ativo) return;
      if (error) setErro(mensagemErro(error));
      setLinhas((data ?? []) as unknown as Linha[]);
      setTotal(count ?? 0);
    });
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual, filtro, termo, pagina, filtroUnidade, unidades.carregado]);

  const mudar = (chave: string, valor: string) => {
    const p = new URLSearchParams(params);
    if (valor) p.set(chave, valor); else p.delete(chave);
    if (chave !== 'pagina') p.delete('pagina');
    setParams(p);
  };
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <>
      <div className="cabecalho-tela">
        <h1>Notícias e avisos</h1>
        <Link className="botao" to="/noticias/nova">Nova notícia</Link>
      </div>
      <form className="filtros" role="search" onSubmit={(e) => { e.preventDefault(); mudar('q', busca.trim()); }}>
        <label>Buscar pelo título<input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
        <label>Situação
          <select value={filtro} onChange={(e) => mudar('situacao', e.target.value)}>
            <option value="">Todas</option>
            <option value="rascunho">Rascunhos</option>
            <option value="agendado">Agendadas</option>
            <option value="publicado">Publicadas</option>
            <option value="despublicado">Despublicadas</option>
          </select>
        </label>
        <button className="botao-secundario">Buscar</button>
      </form>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!linhas ? <p role="status">Carregando…</p> : linhas.length === 0 ? <p>Nenhuma notícia encontrada.</p> : (
        <table className="tabela">
          <caption className="sr-only">Notícias e avisos, {total} no total</caption>
          <thead><tr><th scope="col">Título</th><th scope="col">Tipo</th><th scope="col">Situação</th><th scope="col">Publicação</th><th scope="col">Última alteração</th></tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id}>
                <td><Link to={`/noticias/${l.id}`}>{l.titulo}</Link>{l.destaque && <span className="etiqueta etiqueta-destaque">Destaque</span>}</td>
                <td>{l.tipo === 'aviso' ? 'Aviso' : 'Notícia'}{l.unidade && <><br /><small className="meta">{l.unidade.nome}</small></>}</td>
                <td><EtiquetaSituacao status={l.status} publicadoEm={l.publicado_em} /></td>
                <td>{dataHora(l.publicado_em)}</td>
                <td>{dataHora(l.atualizado_em)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {paginas > 1 && (
        <nav className="paginacao" aria-label="Paginação">
          <button type="button" className="botao-secundario" disabled={pagina <= 1} onClick={() => mudar('pagina', String(pagina - 1))}>Anterior</button>
          <span>Página {pagina} de {paginas}</span>
          <button type="button" className="botao-secundario" disabled={pagina >= paginas} onClick={() => mudar('pagina', String(pagina + 1))}>Próxima</button>
        </nav>
      )}
    </>
  );
}
