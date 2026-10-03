// Lista genérica de conteúdo publicável: busca, filtro por situação e paginação.
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { mensagemErro, supabase } from '../lib/supabase';
import { EtiquetaSituacao } from './Situacao';

export interface Coluna { rotulo: string; render: (linha: any) => ReactNode }

interface Props {
  titulo: string;
  tabela: string;
  /** Colunas carregadas além de id/status/publicado_em. */
  select: string;
  /** Coluna usada na busca e como link para a edição. */
  campoTitulo: string;
  rotaBase: string;
  rotuloNovo: string;
  colunas: Coluna[];
  ordem?: { coluna: string; asc?: boolean }[];
  vazio?: string;
  /** Filtros extras (ex.: tipo). `chaveFiltro` muda quando o filtro muda, para recarregar a lista. */
  filtro?: (q: any) => any;
  chaveFiltro?: string;
  /** Conteúdo acima da tabela (ex.: filtros próprios). */
  acima?: ReactNode;
}

const POR_PAGINA = 20;

export function ListaConteudo(p: Props) {
  const { atual } = useAuth();
  const [params, setParams] = useSearchParams();
  const sit = params.get('situacao') ?? '';
  const termo = params.get('q') ?? '';
  const pagina = Math.max(1, Number(params.get('pagina')) || 1);
  const [linhas, setLinhas] = useState<any[] | null>(null);
  const [total, setTotal] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState(termo);

  useEffect(() => {
    let ativo = true;
    const agora = new Date().toISOString();
    let q = supabase.from(p.tabela)
      .select(`id, status, publicado_em, ${p.select}`, { count: 'exact' })
      .eq('municipio_id', atual!.municipio.id);
    for (const o of p.ordem ?? [{ coluna: 'atualizado_em' }]) q = q.order(o.coluna, { ascending: !!o.asc, nullsFirst: false });
    q = q.range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
    if (sit === 'agendado') q = q.eq('status', 'publicado').gt('publicado_em', agora);
    else if (sit === 'publicado') q = q.eq('status', 'publicado').lte('publicado_em', agora);
    else if (sit) q = q.eq('status', sit);
    if (termo) q = q.ilike(p.campoTitulo, `%${termo.replace(/[%_\\]/g, '\\$&')}%`);
    if (p.filtro) q = p.filtro(q);
    q.then(({ data, count, error }: any) => {
      if (!ativo) return;
      setErro(error ? mensagemErro(error) : null);
      setLinhas(data ?? []);
      setTotal(count ?? 0);
    });
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual, sit, termo, pagina, p.tabela, p.chaveFiltro]);

  const mudar = (chave: string, valor: string) => {
    const n = new URLSearchParams(params);
    if (valor) n.set(chave, valor); else n.delete(chave);
    if (chave !== 'pagina') n.delete('pagina');
    setParams(n);
  };
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <>
      <div className="cabecalho-tela">
        <h1>{p.titulo}</h1>
        <Link className="botao" to={`${p.rotaBase}/novo`}>{p.rotuloNovo}</Link>
      </div>
      <form className="filtros" role="search" onSubmit={(e) => { e.preventDefault(); mudar('q', busca.trim()); }}>
        <label>Buscar<input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
        <label>Situação
          <select value={sit} onChange={(e) => mudar('situacao', e.target.value)}>
            <option value="">Todas</option>
            <option value="rascunho">Rascunhos</option>
            <option value="agendado">Agendados</option>
            <option value="publicado">Publicados</option>
            <option value="despublicado">Despublicados</option>
          </select>
        </label>
        {p.acima}
        <button className="botao-secundario">Buscar</button>
      </form>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!linhas ? <p role="status">Carregando…</p> : linhas.length === 0 ? <p>{p.vazio ?? 'Nada encontrado.'}</p> : (
        <table className="tabela">
          <caption className="sr-only">{p.titulo}, {total} no total</caption>
          <thead><tr>
            <th scope="col">{p.colunas[0]?.rotulo ?? 'Título'}</th>
            {p.colunas.slice(1).map((c) => <th key={c.rotulo} scope="col">{c.rotulo}</th>)}
            <th scope="col">Situação</th>
          </tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id}>
                <td><Link to={`${p.rotaBase}/${l.id}`}>{p.colunas[0] ? p.colunas[0].render(l) : l[p.campoTitulo]}</Link></td>
                {p.colunas.slice(1).map((c) => <td key={c.rotulo}>{c.render(l)}</td>)}
                <td><EtiquetaSituacao status={l.status} publicadoEm={l.publicado_em} /></td>
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
