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

// Origem: só o caminho (sem domínio), minúsculo, começando com "/".
function normalizarOrigem(texto: string) {
  const o = texto.trim().replace(/^https?:\/\/[^/]+/i, '').toLowerCase();
  return o.startsWith('/') ? o : `/${o}`;
}
const destinoValido = (d: string) => /^(https?:\/\/|\/)/.test(d.trim());

// Importação em lote: uma linha por redirecionamento, "endereço antigo;destino;tipo" (tipo opcional,
// 301 se vazio). Aceita ponto e vírgula, tabulação (colar do Excel) ou vírgula, com ou sem aspas.
interface LinhaImportada { origem: string; destino: string; codigo: number }
interface ResultadoLeitura { validas: LinhaImportada[]; problemas: string[] }
function lerCsv(texto: string): ResultadoLeitura {
  const linhas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const amostra = linhas.find((l) => !l.startsWith('#')) ?? '';
  const sep = amostra.includes('\t') ? '\t' : amostra.includes(';') ? ';' : ',';
  const campos = (l: string) => {
    const r: string[] = []; let atual = ''; let aspas = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (c === '"') { if (aspas && l[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas; }
      else if (c === sep && !aspas) { r.push(atual); atual = ''; }
      else atual += c;
    }
    r.push(atual);
    return r.map((x) => x.trim());
  };
  const validas: LinhaImportada[] = []; const problemas: string[] = []; const vistas = new Set<string>();
  linhas.forEach((l, i) => {
    if (l.startsWith('#')) return;
    const [a = '', b = '', c = ''] = campos(l);
    if (i === 0 && !/^(\/|https?:)/i.test(a)) return;                 // cabeçalho
    const n = i + 1;
    const codigo = c === '' ? 301 : Number(c);
    if (![301, 302, 410].includes(codigo)) return problemas.push(`Linha ${n}: tipo "${c}" inválido (use 301, 302 ou 410).`);
    const origem = normalizarOrigem(a);
    if (origem === '/') return problemas.push(`Linha ${n}: falta o endereço antigo.`);
    if (codigo !== 410 && !destinoValido(b)) return problemas.push(`Linha ${n}: o destino "${b}" deve começar com / ou https://.`);
    if (vistas.has(origem)) return problemas.push(`Linha ${n}: ${origem} aparece mais de uma vez no arquivo (vale a primeira).`);
    vistas.add(origem);
    validas.push({ origem, destino: codigo === 410 ? '/' : b, codigo });
  });
  return { validas, problemas };
}

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
    const o = normalizarOrigem(origem);
    if (o === '/') return setErro('Informe o caminho antigo (ex.: /noticia-antiga/).');
    if (codigo !== '410' && !destinoValido(destino)) return setErro('O destino deve começar com / (página do portal) ou https://.');
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

  const [leitura, setLeitura] = useState<ResultadoLeitura | null>(null);
  const [substituir, setSubstituir] = useState(false);
  const [importando, setImportando] = useState(false);
  async function lerArquivo(arquivo: File | undefined) {
    setErro(null); setAviso(null); setLeitura(null);
    if (!arquivo) return;
    if (arquivo.size > 5 * 1024 * 1024) return setErro('Arquivo muito grande (máximo 5 MB).');
    setLeitura(lerCsv(await arquivo.text()));
  }
  async function importar() {
    if (!leitura?.validas.length) return;
    setImportando(true); setErro(null); setAviso(null);
    const linhas = leitura.validas.map((l) => ({ municipio_id: mid, ...l }));
    let enviados = 0;
    for (let i = 0; i < linhas.length; i += 500) {
      const lote = linhas.slice(i, i + 500);
      const { error } = await supabase.from('redirecionamentos')
        .upsert(lote, { onConflict: 'municipio_id,origem', ignoreDuplicates: !substituir });
      if (error) {
        setImportando(false);
        return setErro(`Parou na linha ${i + 1} de ${linhas.length}: ${mensagemErro(error)}. As ${enviados} anteriores foram gravadas.`);
      }
      enviados += lote.length;
    }
    setImportando(false); setLeitura(null);
    setAviso(substituir
      ? `${enviados} redirecionamentos importados (os que já existiam foram atualizados).`
      : `${enviados} linhas processadas. Endereços que já existiam ficaram como estavam.`);
    setPagina(1); carregar();
  }

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
      <section className="painel-form" aria-labelledby="t-importar-redir">
        <h2 id="t-importar-redir">Importar uma lista</h2>
        <p className="meta">Arquivo CSV (ou texto salvo do Excel), uma linha por endereço: <code>endereço antigo;leva para;tipo</code>. O tipo é opcional (301 se vazio). Exemplo: <code>/noticias/antiga.html;/noticias/nova;301</code></p>
        <label>Arquivo<input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => lerArquivo(e.target.files?.[0])} /></label>
        {leitura && (
          <div role="status">
            <p><strong>{leitura.validas.length}</strong> {leitura.validas.length === 1 ? 'linha pronta' : 'linhas prontas'} para importar{leitura.problemas.length > 0 && <>; <strong>{leitura.problemas.length}</strong> com problema (ficam de fora)</>}.</p>
            {leitura.problemas.length > 0 && (
              <details><summary>Ver as linhas com problema</summary>
                <ul>{leitura.problemas.slice(0, 200).map((p) => <li key={p}>{p}</li>)}</ul>
                {leitura.problemas.length > 200 && <p className="meta">E mais {leitura.problemas.length - 200}.</p>}
              </details>
            )}
            {leitura.validas.length > 0 && <>
              <label className="opcao"><input type="checkbox" checked={substituir} onChange={(e) => setSubstituir(e.target.checked)} /> Se o endereço antigo já existir, trocar o destino pelo do arquivo</label>
              <p><button type="button" className="botao-secundario" disabled={importando} onClick={importar}>{importando ? 'Importando…' : `Importar ${leitura.validas.length}`}</button></p>
            </>}
          </div>
        )}
      </section>
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
