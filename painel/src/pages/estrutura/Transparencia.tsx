// Central de Transparência (seções e itens) e sistemas externos (Fiorilli, Betha, IPM, NFS-e...).
// O portal só aponta para os sistemas oficiais; não replica dados (D-07).
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { mensagemErro, supabase } from '../../lib/supabase';
import { slugificar } from '../../lib/texto';
import { Obrigatorio } from '../../components/Edicao';
import { CampoImagem } from '../../components/CampoImagem';
import type { Midia } from '../../lib/midias';

interface Sistema { id: string; nome: string; fornecedor: string | null; categoria: string; url: string; descricao: string | null; ativo: boolean; publico: 'cidadao' | 'servidor';
  na_home: boolean; ordem: number; icone: string | null; logo: Midia | null }

/** Ícones de reserva do bloco "Sistemas" da página inicial (mesmos nomes do portal, components/Icone.astro). */
const ICONES_SISTEMA: Record<string, string> = {
  link: 'Link (padrão)', school: 'Escola', 'graduation-cap': 'Formatura', 'book-open': 'Livro', 'file-text': 'Documento', users: 'Pessoas',
  calendar: 'Calendário', bus: 'Ônibus', utensils: 'Alimentação', landmark: 'Prédio público', 'chart-column': 'Gráfico',
  'messages-square': 'Conversa', megaphone: 'Megafone', 'map-pin': 'Localização',
};
const SELECT_SISTEMA = '*, logo:midias!sistemas_externos_logo_fkey(id, storage_path, nome_original, mime_type, texto_alternativo)';
interface ItemT {
  id: string; secao_id: string; titulo: string; descricao: string | null; url: string | null; pagina_id: string | null; categoria_id: string | null;
  sistema_id: string | null; ordem: number; ativo: boolean;
  pagina: { titulo: string } | null; categoria: { nome: string } | null; sistema: { nome: string } | null;
}
interface Secao { id: string; titulo: string; slug: string; descricao: string | null; ordem: number; itens: ItemT[] }

const CATEGORIAS_SISTEMA: Record<string, string> = {
  transparencia: 'Portal da transparência', tributario: 'Tributário (IPTU, ISS, certidões)', pessoal: 'Pessoal (holerite, servidores)',
  diario_oficial: 'Diário Oficial', ouvidoria: 'Ouvidoria', esic: 'e-SIC', protocolo: 'Protocolo', nfse: 'Nota fiscal (NFS-e)', outro: 'Outro',
};

/** Página própria dos sistemas (menu Estrutura → Sistemas, D-94): públicos e de servidores. */
export function SistemasExternos() {
  return (
    <>
      <div className="cabecalho-tela"><h1>Sistemas</h1></div>
      <Sistemas />
    </>
  );
}

export function Transparencia() {
  const [aba, setAba] = useState<'central' | 'sistemas'>('central');
  return (
    <>
      <div className="cabecalho-tela"><h1>Transparência</h1></div>
      <div className="abas" role="tablist">
        <button type="button" role="tab" aria-selected={aba === 'central'} className={aba === 'central' ? 'aba ativa' : 'aba'} onClick={() => setAba('central')}>Central de Transparência</button>
        <button type="button" role="tab" aria-selected={aba === 'sistemas'} className={aba === 'sistemas' ? 'aba ativa' : 'aba'} onClick={() => setAba('sistemas')}>Sistemas</button>
      </div>
      {aba === 'central' ? <Central /> : <Sistemas />}
    </>
  );
}

function Central() {
  const { atual } = useAuth();
  const mid = atual!.municipio.id;
  const [secoes, setSecoes] = useState<Secao[] | null>(null);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [paginas, setPaginas] = useState<{ id: string; titulo: string; caminho: string }[]>([]);
  const [categorias, setCategorias] = useState<{ id: string; nome: string }[]>([]);
  const [editSecao, setEditSecao] = useState<Secao | 'nova' | null>(null);
  const [editItem, setEditItem] = useState<{ secao: Secao; item: ItemT | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('transparencia_secoes')
      .select(`id, titulo, slug, descricao, ordem, itens:transparencia_itens(id, secao_id, titulo, descricao, url, pagina_id, categoria_id, sistema_id, ordem, ativo,
        pagina:paginas(titulo), categoria:categorias(nome), sistema:sistemas_externos(nome))`)
      .eq('municipio_id', mid).order('ordem');
    if (error) setErro(mensagemErro(error));
    setSecoes(((data ?? []) as unknown as Secao[]).map((s) => ({ ...s, itens: [...s.itens].sort((a, b) => a.ordem - b.ordem) })));
  }, [mid]);
  useEffect(() => {
    carregar();
    supabase.from('sistemas_externos').select('*').eq('municipio_id', mid).order('nome').then(({ data }) => setSistemas(data ?? []));
    supabase.from('paginas').select('id, titulo, caminho').eq('municipio_id', mid).order('caminho').then(({ data }) => setPaginas(data ?? []));
    supabase.from('categorias').select('id, nome').eq('municipio_id', mid).eq('escopo', 'documento').order('nome').then(({ data }) => setCategorias(data ?? []));
  }, [mid, carregar]);

  async function moverSecao(s: Secao, d: -1 | 1) {
    const l = [...(secoes ?? [])]; const i = l.findIndex((x) => x.id === s.id); const j = i + d;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    await Promise.all(l.map((x, k) => supabase.from('transparencia_secoes').update({ ordem: k + 1 }).eq('id', x.id)));
    carregar();
  }
  async function moverItem(s: Secao, it: ItemT, d: -1 | 1) {
    const l = [...s.itens]; const i = l.findIndex((x) => x.id === it.id); const j = i + d;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    await Promise.all(l.map((x, k) => supabase.from('transparencia_itens').update({ ordem: k + 1 }).eq('id', x.id)));
    carregar();
  }
  async function excluir(tabela: string, id: string, texto: string) {
    if (!window.confirm(texto)) return;
    const { error } = await supabase.from(tabela).delete().eq('id', id);
    if (error) setErro(mensagemErro(error)); else carregar();
  }
  const destino = (it: ItemT) => it.sistema ? `Sistema: ${it.sistema.nome}` : it.pagina ? `Página: ${it.pagina.titulo}` : it.categoria ? `Documentos: ${it.categoria.nome}` : it.url;

  return (
    <section role="tabpanel">
      <p className="meta">Seções organizadas no modelo do PNTP. Seção sem nenhum item ativo não aparece no site.</p>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!secoes ? <p role="status">Carregando…</p> : (
        <div className="cartoes-secao">
          {secoes.map((s, i) => (
            <article key={s.id} className="secao-filha">
              <div className="linha-menu">
                <h2>{s.titulo} {s.itens.filter((x) => x.ativo).length === 0 && <span className="etiqueta etiqueta-rascunho">oculta no site</span>}</h2>
                <span className="acoes-linha">
                  <button type="button" className="botao-link" onClick={() => setEditSecao(s)}>Editar seção<span className="sr-only"> {s.titulo}</span></button>
                  <button type="button" className="botao-link" disabled={i === 0} onClick={() => moverSecao(s, -1)}>Subir<span className="sr-only"> {s.titulo}</span></button>
                  <button type="button" className="botao-link" disabled={i === secoes.length - 1} onClick={() => moverSecao(s, 1)}>Descer<span className="sr-only"> {s.titulo}</span></button>
                  <button type="button" className="botao-link" onClick={() => excluir('transparencia_secoes', s.id, `Excluir a seção "${s.titulo}" e todos os seus itens?`)}>Excluir<span className="sr-only"> {s.titulo}</span></button>
                </span>
              </div>
              {s.itens.length > 0 && (
                <ul className="lista-filhos">
                  {s.itens.map((it) => (
                    <li key={it.id} className={it.ativo ? undefined : 'inativo'}>
                      <span><strong>{it.titulo}</strong> <span className="meta">— {destino(it)}{!it.ativo && ' (inativo)'}</span></span>
                      <span className="acoes-linha">
                        <button type="button" className="botao-link" onClick={() => setEditItem({ secao: s, item: it })}>Editar<span className="sr-only"> {it.titulo}</span></button>
                        <button type="button" className="botao-link" onClick={() => moverItem(s, it, -1)}>Subir<span className="sr-only"> {it.titulo}</span></button>
                        <button type="button" className="botao-link" onClick={() => moverItem(s, it, 1)}>Descer<span className="sr-only"> {it.titulo}</span></button>
                        <button type="button" className="botao-link" onClick={() => excluir('transparencia_itens', it.id, `Remover "${it.titulo}" da Central?`)}>Remover<span className="sr-only"> {it.titulo}</span></button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="botao-link" onClick={() => setEditItem({ secao: s, item: null })}>+ Item em {s.titulo}</button>
            </article>
          ))}
        </div>
      )}
      <p><button type="button" className="botao" onClick={() => setEditSecao('nova')}>Nova seção</button></p>
      {editSecao && <FormSecao secao={editSecao === 'nova' ? null : editSecao} mid={mid} ordem={(secoes?.length ?? 0) + 1} aoFechar={(ok) => { setEditSecao(null); if (ok) carregar(); }} />}
      {editItem && <FormItemT key={editItem.item?.id ?? 'novo'} secao={editItem.secao} item={editItem.item} mid={mid} sistemas={sistemas} paginas={paginas} categorias={categorias}
        aoFechar={(ok) => { setEditItem(null); if (ok) carregar(); }} />}
    </section>
  );
}

function FormSecao({ secao, mid, ordem, aoFechar }: { secao: Secao | null; mid: string; ordem: number; aoFechar: (ok: boolean) => void }) {
  const [titulo, setTitulo] = useState(secao?.titulo ?? '');
  const [descricao, setDescricao] = useState(secao?.descricao ?? '');
  const [erro, setErro] = useState<string | null>(null);
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    if (!titulo.trim()) return setErro('Informe o título.');
    const r = secao
      ? await supabase.from('transparencia_secoes').update({ titulo: titulo.trim(), descricao: descricao.trim() || null }).eq('id', secao.id)
      : await supabase.from('transparencia_secoes').insert({ municipio_id: mid, titulo: titulo.trim(), slug: slugificar(titulo), descricao: descricao.trim() || null, ordem });
    if (r.error) return setErro(mensagemErro(r.error));
    aoFechar(true);
  }
  return (
    <form className="painel-form" onSubmit={salvar} aria-labelledby="t-secao">
      <h2 id="t-secao">{secao ? `Editar seção "${secao.titulo}"` : 'Nova seção'}</h2>
      <label><Obrigatorio>Título</Obrigatorio><input value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus /></label>
      <label>Descrição (opcional)<input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></label>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <p className="acoes-linha"><button className="botao">Salvar seção</button><button type="button" className="botao-secundario" onClick={() => aoFechar(false)}>Cancelar</button></p>
    </form>
  );
}

type DestinoT = 'sistema' | 'pagina' | 'categoria' | 'url';
function FormItemT({ secao, item, mid, sistemas, paginas, categorias, aoFechar }: {
  secao: Secao; item: ItemT | null; mid: string; sistemas: Sistema[];
  paginas: { id: string; titulo: string; caminho: string }[]; categorias: { id: string; nome: string }[]; aoFechar: (ok: boolean) => void;
}) {
  const [titulo, setTitulo] = useState(item?.titulo ?? '');
  const [descricao, setDescricao] = useState(item?.descricao ?? '');
  const [destino, setDestino] = useState<DestinoT>(item?.sistema_id ? 'sistema' : item?.pagina_id ? 'pagina' : item?.categoria_id ? 'categoria' : item ? 'url' : 'sistema');
  const [sistemaId, setSistemaId] = useState(item?.sistema_id ?? '');
  const [paginaId, setPaginaId] = useState(item?.pagina_id ?? '');
  const [categoriaId, setCategoriaId] = useState(item?.categoria_id ?? '');
  const [url, setUrl] = useState(item?.url ?? '');
  const [ativo, setAtivo] = useState(item?.ativo ?? true);
  const [erro, setErro] = useState<string | null>(null);
  async function salvar(ev: FormEvent) {
    ev.preventDefault(); setErro(null);
    if (!titulo.trim()) return setErro('Informe o título.');
    const alvo = { sistema: sistemaId, pagina: paginaId, categoria: categoriaId, url: url.trim() }[destino];
    if (!alvo) return setErro('Escolha para onde o item leva.');
    if (destino === 'url' && !/^(https?:\/\/|\/)/.test(alvo)) return setErro('O link deve começar com https:// ou com /.');
    const linha = {
      secao_id: secao.id, municipio_id: mid, titulo: titulo.trim(), descricao: descricao.trim() || null, ativo,
      sistema_id: destino === 'sistema' ? sistemaId : null, pagina_id: destino === 'pagina' ? paginaId : null,
      categoria_id: destino === 'categoria' ? categoriaId : null, url: destino === 'url' ? url.trim() : null,
    };
    const r = item ? await supabase.from('transparencia_itens').update(linha).eq('id', item.id)
      : await supabase.from('transparencia_itens').insert({ ...linha, ordem: secao.itens.length + 1 });
    if (r.error) return setErro(mensagemErro(r.error));
    aoFechar(true);
  }
  return (
    <form className="painel-form" onSubmit={salvar} aria-labelledby="t-itemt">
      <h2 id="t-itemt">{item ? `Editar "${item.titulo}"` : `Novo item em "${secao.titulo}"`}</h2>
      <label><Obrigatorio>Título</Obrigatorio><input value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus placeholder="Ex.: Folha de pagamento" /></label>
      <label>Descrição (opcional)<input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></label>
      <fieldset><legend>Leva para</legend>
        {([['sistema', 'Um sistema externo'], ['categoria', 'Uma categoria de documentos do portal'], ['pagina', 'Uma página do portal'], ['url', 'Um endereço']] as [DestinoT, string][]).map(([v, r]) => (
          <label key={v} className="opcao"><input type="radio" name="destinot" checked={destino === v} onChange={() => setDestino(v)} /> {r}</label>
        ))}
      </fieldset>
      {destino === 'sistema' && (sistemas.length === 0 ? <p className="meta">Cadastre o sistema em Estrutura → Sistemas (ou na aba "Sistemas").</p> : (
        <label>Sistema<select value={sistemaId} onChange={(e) => setSistemaId(e.target.value)}><option value="">Escolha…</option>{sistemas.map((s) => <option key={s.id} value={s.id}>{s.nome}{s.fornecedor && ` (${s.fornecedor})`}</option>)}</select></label>
      ))}
      {destino === 'categoria' && <label>Categoria<select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}><option value="">Escolha…</option>{categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>}
      {destino === 'pagina' && <label>Página<select value={paginaId} onChange={(e) => setPaginaId(e.target.value)}><option value="">Escolha…</option>{paginas.map((p) => <option key={p.id} value={p.id}>{p.titulo} (/{p.caminho})</option>)}</select></label>}
      {destino === 'url' && <label>Endereço<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></label>}
      <label className="opcao"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativo (aparece no site)</label>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <p className="acoes-linha"><button className="botao">Salvar item</button><button type="button" className="botao-secundario" onClick={() => aoFechar(false)}>Cancelar</button></p>
    </form>
  );
}

function Sistemas() {
  const { atual } = useAuth();
  const mid = atual!.municipio.id;
  const [lista, setLista] = useState<Sistema[] | null>(null);
  const [edit, setEdit] = useState<Sistema | 'novo' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(() => {
    supabase.from('sistemas_externos').select(SELECT_SISTEMA).eq('municipio_id', mid).order('nome').then(({ data }) => setLista((data ?? []) as Sistema[]));
  }, [mid]);
  useEffect(() => { carregar(); }, [carregar]);
  async function excluir(s: Sistema) {
    if (!window.confirm(`Excluir o sistema "${s.nome}"?`)) return;
    const { error } = await supabase.from('sistemas_externos').delete().eq('id', s.id);
    if (error) setErro(error.code === '23503' ? 'Este sistema está em uso na Central de Transparência. Remova os itens que apontam para ele, ou apenas desative-o.' : mensagemErro(error));
    else carregar();
  }
  return (
    <section role="tabpanel">
      <p className="meta">Sistemas oficiais (Fiorilli, Betha, IPM, Governo Federal...). Os <strong>públicos</strong> aparecem como link na Central de Transparência e nos serviços do portal. Os <strong>de servidores</strong> aparecem só no painel, em "Meus sistemas", para os papéis escolhidos (D-94).</p>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!lista ? <p role="status">Carregando…</p> : (
        <table className="tabela">
          <thead><tr><th scope="col">Sistema</th><th scope="col">Para</th><th scope="col">Tipo</th><th scope="col">Endereço</th><th scope="col">Situação</th><th scope="col">Página inicial</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
          <tbody>{lista.map((s) => (
            <tr key={s.id}>
              <td>{s.nome}{s.fornecedor && <span className="meta"> · {s.fornecedor}</span>}</td>
              <td>{s.publico === 'servidor' ? 'Servidores' : 'Público'}</td>
              <td>{CATEGORIAS_SISTEMA[s.categoria]}</td>
              <td><a href={s.url} target="_blank" rel="noopener">{s.url.replace(/^https?:\/\//, '').slice(0, 45)}</a></td>
              <td>{s.ativo ? 'Ativo' : 'Inativo'}</td>
              <td>{s.na_home && s.publico === 'cidadao' ? `Sim (ordem ${s.ordem})` : 'Não'}</td>
              <td className="acoes-linha">
                <button type="button" className="botao-link" onClick={() => setEdit(s)}>Editar<span className="sr-only"> {s.nome}</span></button>
                <button type="button" className="botao-link" onClick={() => excluir(s)}>Excluir<span className="sr-only"> {s.nome}</span></button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      )}
      <p><button type="button" className="botao" onClick={() => setEdit('novo')}>Novo sistema</button></p>
      {edit && <FormSistema sistema={edit === 'novo' ? null : edit} mid={mid} aoFechar={(ok) => { setEdit(null); if (ok) carregar(); }} />}
    </section>
  );
}

function FormSistema({ sistema, mid, aoFechar }: { sistema: Sistema | null; mid: string; aoFechar: (ok: boolean) => void }) {
  const [nome, setNome] = useState(sistema?.nome ?? '');
  const [fornecedor, setFornecedor] = useState(sistema?.fornecedor ?? '');
  const [categoria, setCategoria] = useState(sistema?.categoria ?? 'transparencia');
  const [url, setUrl] = useState(sistema?.url ?? '');
  const [ativo, setAtivo] = useState(sistema?.ativo ?? true);
  const [descricao, setDescricao] = useState(sistema?.descricao ?? '');
  const [publico, setPublico] = useState<'cidadao' | 'servidor'>(sistema?.publico ?? 'cidadao');
  const [naHome, setNaHome] = useState(sistema?.na_home ?? false);
  const [ordem, setOrdem] = useState(String(sistema?.ordem ?? 0));
  const [icone, setIcone] = useState(sistema?.icone ?? 'link');
  const [logo, setLogo] = useState<Midia | null>(sistema?.logo ?? null);
  const [papeis, setPapeis] = useState<{ id: string; nome: string }[]>([]);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    supabase.from('papeis').select('id, nome').eq('municipio_id', mid).eq('ativo', true).order('nome').then(({ data }) => setPapeis(data ?? []));
    if (sistema) supabase.from('sistema_papeis').select('papel_id').eq('sistema_id', sistema.id).then(({ data }) => setMarcados(new Set((data ?? []).map((x) => x.papel_id))));
  }, [mid, sistema]);
  const marcar = (id: string, sim: boolean) => setMarcados((m) => { const n = new Set(m); if (sim) n.add(id); else n.delete(id); return n; });
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    if (!nome.trim()) return setErro('Informe o nome.');
    if (!/^https?:\/\//.test(url.trim())) return setErro('O endereço deve começar com http:// ou https://.');
    if (logo && !logo.texto_alternativo?.trim()) return setErro('O logo precisa de texto alternativo.');
    const linha = { municipio_id: mid, nome: nome.trim(), fornecedor: fornecedor.trim() || null, categoria, url: url.trim(), ativo, publico, descricao: descricao.trim() || null,
      na_home: publico === 'cidadao' && naHome, ordem: Number.parseInt(ordem, 10) || 0, icone: icone || null, logo_id: logo?.id ?? null };
    const r = sistema
      ? await supabase.from('sistemas_externos').update(linha).eq('id', sistema.id).select('id').single()
      : await supabase.from('sistemas_externos').insert(linha).select('id').single();
    if (r.error) return setErro(mensagemErro(r.error));
    // Papéis que veem o sistema em "Meus sistemas" (nenhum marcado = todos os servidores).
    const id = r.data.id as string;
    const apagar = await supabase.from('sistema_papeis').delete().eq('sistema_id', id);
    if (apagar.error) return setErro(mensagemErro(apagar.error));
    if (publico === 'servidor' && marcados.size) {
      const ins = await supabase.from('sistema_papeis').insert([...marcados].map((papel_id) => ({ municipio_id: mid, sistema_id: id, papel_id })));
      if (ins.error) return setErro(mensagemErro(ins.error));
    }
    aoFechar(true);
  }
  return (
    <form className="painel-form" onSubmit={salvar} aria-labelledby="t-sis">
      <h2 id="t-sis">{sistema ? `Editar "${sistema.nome}"` : 'Novo sistema externo'}</h2>
      <div className="linha-campos">
        <label><Obrigatorio>Nome</Obrigatorio><input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex.: Portal da Transparência" /></label>
        <label>Fornecedor<input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Ex.: Fiorilli" /></label>
      </div>
      <label>Tipo<select value={categoria} onChange={(e) => setCategoria(e.target.value)}>{Object.entries(CATEGORIAS_SISTEMA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></label>
      <label><Obrigatorio>Endereço</Obrigatorio><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></label>
      <label>Descrição (opcional)<input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: matrícula e fila das creches" /></label>
      <fieldset>
        <legend>Para quem</legend>
        <label className="opcao"><input type="radio" name="publico" checked={publico === 'cidadao'} onChange={() => setPublico('cidadao')} /> Público: link no portal (Transparência e serviços)</label>
        <label className="opcao"><input type="radio" name="publico" checked={publico === 'servidor'} onChange={() => setPublico('servidor')} /> Servidores: atalho no painel, em "Meus sistemas"</label>
      </fieldset>
      {publico === 'cidadao' && (
        <fieldset>
          <legend>Página inicial do portal</legend>
          <label className="opcao"><input type="checkbox" checked={naHome} onChange={(e) => setNaHome(e.target.checked)} /> Mostrar no bloco "Sistemas" da página inicial</label>
          {naHome && (
            <>
              <div className="linha-campos">
                <label>Ordem<input type="number" value={ordem} onChange={(e) => setOrdem(e.target.value)} min={0} /></label>
                <label>Ícone (usado quando não há logo)<select value={icone} onChange={(e) => setIcone(e.target.value)}>{Object.entries(ICONES_SISTEMA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></label>
              </div>
              <CampoImagem rotulo="Logo do sistema (opcional; fica num círculo branco)" municipioId={mid} midia={logo} aoMudar={setLogo} />
            </>
          )}
        </fieldset>
      )}
      {publico === 'servidor' && (
        <fieldset>
          <legend>Quais papéis veem este sistema</legend>
          <p className="meta">Nenhum marcado: todos os servidores da organização. O Administrador vê sempre.</p>
          {papeis.map((p) => (
            <label key={p.id} className="opcao"><input type="checkbox" checked={marcados.has(p.id)} onChange={(e) => marcar(p.id, e.target.checked)} /> {p.nome}</label>
          ))}
        </fieldset>
      )}
      <label className="opcao"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativo</label>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <p className="acoes-linha"><button className="botao">Salvar sistema</button><button type="button" className="botao-secundario" onClick={() => aoFechar(false)}>Cancelar</button></p>
    </form>
  );
}
