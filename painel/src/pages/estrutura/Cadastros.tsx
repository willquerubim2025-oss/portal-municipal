// Categorias (publicador/admin) e redirecionamentos 301 (admin).
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { mensagemErro, supabase } from '../../lib/supabase';
import { dataHora, slugificar } from '../../lib/texto';
import { Obrigatorio } from '../../components/Edicao';

const ESCOPOS: [string, string][] = [
  ['publicacao', 'Notícias'], ['documento', 'Documentos'], ['servico', 'Serviços'], ['evento', 'Agenda'], ['pergunta', 'Perguntas frequentes'],
];
interface Categoria { id: string; nome: string; slug: string; descricao: string | null; ordem: number }

export function Categorias() {
  const { atual } = useAuth();
  const mid = atual!.municipio.id;
  const [escopo, setEscopo] = useState('publicacao');
  const [lista, setLista] = useState<Categoria[] | null>(null);
  const [nome, setNome] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    supabase.from('categorias').select('id, nome, slug, descricao, ordem').eq('municipio_id', mid).eq('escopo', escopo).order('ordem').order('nome')
      .then(({ data }) => setLista(data ?? []));
  }, [mid, escopo]);
  useEffect(() => { setLista(null); carregar(); }, [carregar]);

  async function criar(ev: FormEvent) {
    ev.preventDefault(); setErro(null);
    if (!nome.trim()) return;
    const { error } = await supabase.from('categorias').insert({ municipio_id: mid, escopo, nome: nome.trim(), slug: slugificar(nome), ordem: (lista?.length ?? 0) + 1 });
    if (error) return setErro(mensagemErro(error));
    setNome(''); carregar();
  }
  async function renomear(c: Categoria, novo: string) {
    setEditando(null);
    if (!novo.trim() || novo.trim() === c.nome) return;
    // O endereço (slug) não muda: links de categoria já compartilhados continuam funcionando.
    const { error } = await supabase.from('categorias').update({ nome: novo.trim() }).eq('id', c.id);
    if (error) setErro(mensagemErro(error)); else carregar();
  }
  async function excluir(c: Categoria) {
    if (!window.confirm(`Excluir a categoria "${c.nome}"? Os conteúdos dela ficam sem categoria.`)) return;
    const { error } = await supabase.from('categorias').delete().eq('id', c.id);
    if (error) setErro(error.code === '23503' ? 'Esta categoria está em uso na Central de Transparência ou em um menu. Remova de lá primeiro.' : mensagemErro(error));
    else carregar();
  }

  return (
    <>
      <div className="cabecalho-tela"><h1>Categorias</h1></div>
      <div className="abas" role="tablist">
        {ESCOPOS.map(([v, r]) => <button key={v} type="button" role="tab" aria-selected={escopo === v} className={escopo === v ? 'aba ativa' : 'aba'} onClick={() => setEscopo(v)}>{r}</button>)}
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <section role="tabpanel">
        {!lista ? <p role="status">Carregando…</p> : lista.length === 0 ? <p>Nenhuma categoria.</p> : (
          <ul className="lista-filhos">
            {lista.map((c) => (
              <li key={c.id}>
                {editando === c.id
                  ? <input defaultValue={c.nome} autoFocus aria-label={`Novo nome de ${c.nome}`} onBlur={(e) => renomear(c, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); renomear(c, e.currentTarget.value); } if (e.key === 'Escape') setEditando(null); }} />
                  : <strong>{c.nome}</strong>}
                <span className="meta">{c.slug}</span>
                <span className="acoes-linha">
                  <button type="button" className="botao-link" onClick={() => setEditando(c.id)}>Renomear<span className="sr-only"> {c.nome}</span></button>
                  <button type="button" className="botao-link" onClick={() => excluir(c)}>Excluir<span className="sr-only"> {c.nome}</span></button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <form className="filtros" onSubmit={criar}>
          <label>Nova categoria<input value={nome} onChange={(e) => setNome(e.target.value)} /></label>
          <button className="botao-secundario">Adicionar</button>
        </form>
      </section>
    </>
  );
}

interface Redir { id: string; origem: string; destino: string; codigo: number; acessos: number; ultimo_acesso: string | null }
const POR_PAGINA = 50;

export function Redirecionamentos() {
  const { atual } = useAuth();
  const mid = atual!.municipio.id;
  const [lista, setLista] = useState<Redir[] | null>(null);
  const [total, setTotal] = useState(0);
  const [busca, setBusca] = useState('');
  const [termo, setTermo] = useState('');
  const [pagina, setPagina] = useState(1);
  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [codigo, setCodigo] = useState('301');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(() => {
    let q = supabase.from('redirecionamentos').select('id, origem, destino, codigo, acessos, ultimo_acesso', { count: 'exact' })
      .eq('municipio_id', mid).order('acessos', { ascending: false }).order('origem').range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
    if (termo) q = q.or(`origem.ilike.%${termo}%,destino.ilike.%${termo}%`);
    q.then(({ data, count }) => { setLista(data ?? []); setTotal(count ?? 0); });
  }, [mid, termo, pagina]);
  useEffect(() => { carregar(); }, [carregar]);

  async function criar(ev: FormEvent) {
    ev.preventDefault(); setErro(null); setAviso(null);
    // Origem: só o caminho (sem domínio), minúsculo, começando com "/".
    let o = origem.trim().replace(/^https?:\/\/[^/]+/i, '').toLowerCase();
    if (!o.startsWith('/')) o = `/${o}`;
    if (o === '/') return setErro('Informe o caminho antigo (ex.: /noticia-antiga/).');
    if (codigo !== '410' && !/^(https?:\/\/|\/)/.test(destino.trim())) return setErro('O destino deve começar com / (página do portal) ou https://.');
    const { error } = await supabase.from('redirecionamentos').insert({ municipio_id: mid, origem: o, destino: codigo === '410' ? '/' : destino.trim(), codigo: Number(codigo) });
    if (error) return setErro(error.code === '23505' ? `Já existe um redirecionamento para ${o}.` : mensagemErro(error));
    setOrigem(''); setDestino(''); setAviso(`Redirecionamento de ${o} criado.`); carregar();
  }
  async function excluir(r: Redir) {
    if (!window.confirm(`Excluir o redirecionamento de ${r.origem}? Quem acessar o endereço antigo verá "página não encontrada".`)) return;
    const { error } = await supabase.from('redirecionamentos').delete().eq('id', r.id);
    if (error) setErro(mensagemErro(error)); else carregar();
  }
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <>
      <div className="cabecalho-tela"><h1>Redirecionamentos</h1></div>
      <p className="meta">Endereços do site antigo que levam para as páginas novas (301), sem perder visitantes nem posição no Google. A migração do WordPress cria a maior parte automaticamente.</p>
      <div aria-live="polite">{erro && <p className="erro" role="alert">{erro}</p>}{aviso && <p className="sucesso" role="status">{aviso}</p>}</div>
      <form className="painel-form" onSubmit={criar} aria-labelledby="t-novo-redir">
        <h2 id="t-novo-redir">Novo redirecionamento</h2>
        <div className="linha-campos">
          <label><Obrigatorio>Endereço antigo</Obrigatorio><input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="/noticia-antiga/ ou https://site-antigo/..." /></label>
          <label>Leva para<input value={destino} disabled={codigo === '410'} onChange={(e) => setDestino(e.target.value)} placeholder="/noticias/nova" /></label>
          <label>Tipo
            <select value={codigo} onChange={(e) => setCodigo(e.target.value)}>
              <option value="301">Permanente (301)</option>
              <option value="302">Temporário (302)</option>
              <option value="410">Removido de propósito (410)</option>
            </select>
          </label>
        </div>
        <p><button className="botao-secundario">Criar</button></p>
      </form>
      <form className="filtros" role="search" onSubmit={(e) => { e.preventDefault(); setPagina(1); setTermo(busca.trim().toLowerCase().replace(/[%_,()]/g, '')); }}>
        <label>Buscar endereço<input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
        <button className="botao-secundario">Buscar</button>
      </form>
      {!lista ? <p role="status">Carregando…</p> : lista.length === 0 ? <p>Nenhum redirecionamento.</p> : (
        <table className="tabela">
          <caption className="sr-only">Redirecionamentos, {total} no total</caption>
          <thead><tr><th scope="col">Endereço antigo</th><th scope="col">Leva para</th><th scope="col">Tipo</th><th scope="col">Acessos</th><th scope="col">Último acesso</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
          <tbody>{lista.map((r) => (
            <tr key={r.id}>
              <td><code>{r.origem}</code></td>
              <td>{r.codigo === 410 ? <em>removido</em> : <code>{r.destino}</code>}</td>
              <td>{r.codigo}</td>
              <td>{r.acessos}</td>
              <td>{dataHora(r.ultimo_acesso)}</td>
              <td><button type="button" className="botao-link" onClick={() => excluir(r)}>Excluir<span className="sr-only"> {r.origem}</span></button></td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {paginas > 1 && (
        <nav className="paginacao" aria-label="Paginação">
          <button type="button" className="botao-secundario" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
          <span>Página {pagina} de {paginas}</span>
          <button type="button" className="botao-secundario" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>Próxima</button>
        </nav>
      )}
    </>
  );
}
