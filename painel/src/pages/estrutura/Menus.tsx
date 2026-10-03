// Menus do portal (principal, rodapé, atalhos da home). Dois níveis: item e subitem.
// Menu vazio = o portal usa o menu padrão montado a partir dos módulos ligados.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { mensagemErro, supabase } from '../../lib/supabase';
import { Obrigatorio } from '../../components/Edicao';

interface Menu { id: string; local: string; nome: string }
interface Item {
  id: string; parent_id: string | null; rotulo: string; url: string | null; nova_aba: boolean; ordem: number;
  pagina_id: string | null; categoria_id: string | null;
  pagina: { titulo: string; caminho: string } | null; categoria: { nome: string; escopo: string } | null;
}
type Destino = 'pagina' | 'categoria' | 'url' | 'nenhum';
const ESCOPO: Record<string, string> = { publicacao: 'Notícias', documento: 'Documentos', servico: 'Serviços', evento: 'Agenda', pergunta: 'Perguntas' };
const DESCRICAO_LOCAL: Record<string, string> = {
  principal: 'Barra de navegação no topo de todas as páginas.',
  rodape: 'Coluna "Links úteis" no rodapé.',
  atalhos: 'Botões de "Acesso rápido" na página inicial.',
};
const PADRAO = [
  ['Início', '/'], ['Notícias', '/noticias'], ['Serviços', '/servicos'], ['Legislação', '/legislacao'],
  ['Documentos', '/documentos'], ['Transparência', '/transparencia'], ['Agenda', '/eventos'], ['Estrutura', '/estrutura-organizacional'],
];

export function Menus() {
  const { atual } = useAuth();
  const mid = atual!.municipio.id;
  const [menus, setMenus] = useState<Menu[]>([]);
  const [menuId, setMenuId] = useState('');
  const [itens, setItens] = useState<Item[] | null>(null);
  const [paginas, setPaginas] = useState<{ id: string; titulo: string; caminho: string }[]>([]);
  const [categorias, setCategorias] = useState<{ id: string; nome: string; escopo: string }[]>([]);
  const [editando, setEditando] = useState<Item | 'novo' | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('menus').select('id, local, nome').eq('municipio_id', mid).order('local').then(({ data }) => {
      const ordem = ['principal', 'rodape', 'atalhos'];
      const m = (data ?? []).sort((a, b) => (ordem.indexOf(a.local) + 1 || 99) - (ordem.indexOf(b.local) + 1 || 99));
      setMenus(m); setMenuId((x) => x || m[0]?.id || '');
    });
    supabase.from('paginas').select('id, titulo, caminho').eq('municipio_id', mid).order('caminho').then(({ data }) => setPaginas(data ?? []));
    supabase.from('categorias').select('id, nome, escopo').eq('municipio_id', mid).order('escopo').order('nome').then(({ data }) => setCategorias(data ?? []));
  }, [mid]);

  const carregar = useCallback(async () => {
    if (!menuId) return;
    const { data, error } = await supabase.from('menu_itens')
      .select('id, parent_id, rotulo, url, nova_aba, ordem, pagina_id, categoria_id, pagina:paginas(titulo, caminho), categoria:categorias(nome, escopo)')
      .eq('menu_id', menuId).order('ordem');
    if (error) setErro(mensagemErro(error));
    setItens((data ?? []) as unknown as Item[]);
  }, [menuId]);
  useEffect(() => { setItens(null); setEditando(null); carregar(); }, [carregar]);

  const menu = menus.find((m) => m.id === menuId);
  const raiz = (itens ?? []).filter((i) => !i.parent_id);
  const filhos = (id: string) => (itens ?? []).filter((i) => i.parent_id === id);

  async function mover(item: Item, d: -1 | 1) {
    const irmaos = (itens ?? []).filter((i) => i.parent_id === item.parent_id);
    const i = irmaos.findIndex((x) => x.id === item.id); const j = i + d;
    if (j < 0 || j >= irmaos.length) return;
    [irmaos[i], irmaos[j]] = [irmaos[j], irmaos[i]];
    await Promise.all(irmaos.map((x, k) => supabase.from('menu_itens').update({ ordem: k }).eq('id', x.id)));
    carregar();
  }
  async function remover(item: Item) {
    const n = filhos(item.id).length;
    if (!window.confirm(`Remover "${item.rotulo}"${n ? ` e os ${n} subitens` : ''} do menu?`)) return;
    const { error } = await supabase.from('menu_itens').delete().eq('id', item.id);
    if (error) setErro(mensagemErro(error)); else carregar();
  }
  async function usarPadrao() {
    const { error } = await supabase.from('menu_itens').insert(PADRAO.map(([rotulo, url], ordem) => ({ menu_id: menuId, municipio_id: mid, rotulo, url, ordem })));
    if (error) setErro(mensagemErro(error)); else carregar();
  }

  const destinoTexto = (i: Item) => i.pagina ? `Página /${i.pagina.caminho}` : i.categoria ? `${ESCOPO[i.categoria.escopo]}: ${i.categoria.nome}` : i.url ?? 'Grupo (sem link)';
  const Linha = ({ i, sub }: { i: Item; sub?: boolean }) => (
    <li>
      <div className="linha-menu">
        <span><strong>{i.rotulo}</strong> <span className="meta">— {destinoTexto(i)}{i.nova_aba && ' (nova aba)'}</span></span>
        <span className="acoes-linha">
          <button type="button" className="botao-link" onClick={() => setEditando(i)}>Editar<span className="sr-only"> {i.rotulo}</span></button>
          <button type="button" className="botao-link" onClick={() => mover(i, -1)}>Subir<span className="sr-only"> {i.rotulo}</span></button>
          <button type="button" className="botao-link" onClick={() => mover(i, 1)}>Descer<span className="sr-only"> {i.rotulo}</span></button>
          <button type="button" className="botao-link" onClick={() => remover(i)}>Remover<span className="sr-only"> {i.rotulo}</span></button>
        </span>
      </div>
      {!sub && filhos(i.id).length > 0 && <ul className="arvore-sub">{filhos(i.id).map((f) => <Linha key={f.id} i={f} sub />)}</ul>}
    </li>
  );

  return (
    <>
      <div className="cabecalho-tela"><h1>Menus</h1></div>
      <div className="abas" role="tablist" aria-label="Menus do portal">
        {menus.map((m) => (
          <button key={m.id} type="button" role="tab" aria-selected={m.id === menuId} className={m.id === menuId ? 'aba ativa' : 'aba'} onClick={() => setMenuId(m.id)}>{m.nome}</button>
        ))}
      </div>
      {menu && <p className="meta">{DESCRICAO_LOCAL[menu.local] ?? ''}</p>}
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!itens ? <p role="status">Carregando…</p> : (
        <section role="tabpanel" aria-label={menu?.nome}>
          {itens.length === 0 ? (
            <div className="aviso-bloqueio">
              <p>Este menu está vazio{menu?.local === 'principal' || menu?.local === 'atalhos' ? ': o portal mostra o menu padrão, montado a partir dos módulos ligados.' : '.'}</p>
              {menu?.local === 'principal' && <button type="button" className="botao-secundario" onClick={usarPadrao}>Começar com o menu padrão</button>}
            </div>
          ) : <ul className="arvore">{raiz.map((i) => <Linha key={i.id} i={i} />)}</ul>}
          <p><button type="button" className="botao" onClick={() => setEditando('novo')}>Adicionar item</button></p>
        </section>
      )}
      {editando && (
        <FormItem key={editando === 'novo' ? 'novo' : editando.id} item={editando === 'novo' ? null : editando}
          menuId={menuId} mid={mid} raiz={raiz} paginas={paginas} categorias={categorias}
          aoFechar={(salvo) => { setEditando(null); if (salvo) carregar(); }} />
      )}
    </>
  );
}

function FormItem({ item, menuId, mid, raiz, paginas, categorias, aoFechar }: {
  item: Item | null; menuId: string; mid: string; raiz: Item[];
  paginas: { id: string; titulo: string; caminho: string }[]; categorias: { id: string; nome: string; escopo: string }[];
  aoFechar: (salvo: boolean) => void;
}) {
  const inicial: Destino = item?.pagina_id ? 'pagina' : item?.categoria_id ? 'categoria' : item?.url ? 'url' : item ? 'nenhum' : 'pagina';
  const [rotulo, setRotulo] = useState(item?.rotulo ?? '');
  const [destino, setDestino] = useState<Destino>(inicial);
  const [paginaId, setPaginaId] = useState(item?.pagina_id ?? '');
  const [categoriaId, setCategoriaId] = useState(item?.categoria_id ?? '');
  const [url, setUrl] = useState(item?.url ?? '');
  const [parentId, setParentId] = useState(item?.parent_id ?? '');
  const [novaAba, setNovaAba] = useState(item?.nova_aba ?? false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(ev: FormEvent) {
    ev.preventDefault(); setErro(null);
    if (!rotulo.trim()) return setErro('Informe o texto do item.');
    if (destino === 'pagina' && !paginaId) return setErro('Escolha a página.');
    if (destino === 'categoria' && !categoriaId) return setErro('Escolha a categoria.');
    if (destino === 'url' && !/^(https?:\/\/|\/)/.test(url.trim())) return setErro('O link deve começar com https:// ou com / (página do próprio portal).');
    const linha = {
      menu_id: menuId, municipio_id: mid, rotulo: rotulo.trim(), parent_id: parentId || null, nova_aba: novaAba,
      pagina_id: destino === 'pagina' ? paginaId : null, categoria_id: destino === 'categoria' ? categoriaId : null, url: destino === 'url' ? url.trim() : null,
    };
    const r = item
      ? await supabase.from('menu_itens').update(linha).eq('id', item.id)
      : await supabase.from('menu_itens').insert({ ...linha, ordem: 999 });
    if (r.error) return setErro(mensagemErro(r.error));
    aoFechar(true);
  }

  return (
    <form className="painel-form" onSubmit={salvar} aria-labelledby="t-item">
      <h2 id="t-item">{item ? `Editar "${item.rotulo}"` : 'Novo item'}</h2>
      <label><Obrigatorio>Texto no menu</Obrigatorio><input value={rotulo} onChange={(e) => setRotulo(e.target.value)} maxLength={60} autoFocus /></label>
      <fieldset><legend>Leva para</legend>
        {([['pagina', 'Uma página'], ['categoria', 'Uma categoria (lista de notícias, documentos...)'], ['url', 'Um endereço (do portal ou externo)'], ['nenhum', 'Nada (só agrupa subitens)']] as [Destino, string][]).map(([v, r]) => (
          <label key={v} className="opcao"><input type="radio" name="destino" checked={destino === v} onChange={() => setDestino(v)} /> {r}</label>
        ))}
      </fieldset>
      {destino === 'pagina' && (
        <label>Página<select value={paginaId} onChange={(e) => setPaginaId(e.target.value)}>
          <option value="">Escolha…</option>{paginas.map((p) => <option key={p.id} value={p.id}>{p.titulo} (/{p.caminho})</option>)}
        </select></label>
      )}
      {destino === 'categoria' && (
        <label>Categoria<select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">Escolha…</option>{categorias.map((c) => <option key={c.id} value={c.id}>{ESCOPO[c.escopo]}: {c.nome}</option>)}
        </select></label>
      )}
      {destino === 'url' && <label>Endereço<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/transparencia ou https://..." /></label>}
      <label>Dentro de
        <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">— (item principal)</option>
          {raiz.filter((r) => r.id !== item?.id).map((r) => <option key={r.id} value={r.id}>{r.rotulo}</option>)}
        </select>
      </label>
      <label className="opcao"><input type="checkbox" checked={novaAba} onChange={(e) => setNovaAba(e.target.checked)} /> Abrir em nova aba (só para sites externos)</label>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <p className="acoes-linha"><button className="botao">Salvar item</button><button type="button" className="botao-secundario" onClick={() => aoFechar(false)}>Cancelar</button></p>
    </form>
  );
}
