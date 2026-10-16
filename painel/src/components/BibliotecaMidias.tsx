// Biblioteca de mídias (D-92): escolher uma imagem já enviada pela organização, em vez de
// enviar o mesmo arquivo de novo. Abre num <dialog> nativo (foco preso, Esc fecha) e lista as
// imagens mais recentes, com busca pela descrição (texto alternativo) ou pelo nome do arquivo.
// Desenhada no <body> (portal do React): a busca é um <form> e não pode ficar dentro do formulário de edição.
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Midia } from '../lib/midias';
import { mensagemErro, supabase, urlMidia } from '../lib/supabase';

const POR_PAGINA = 24;

interface Props {
  municipioId: string;
  aberta: boolean;
  aoFechar: () => void;
  aoEscolher: (m: Midia) => void;
}

export function BibliotecaMidias({ municipioId, aberta, aoFechar, aoEscolher }: Props) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const [busca, setBusca] = useState('');
  const [termo, setTermo] = useState('');
  const [pagina, setPagina] = useState(0);
  const [itens, setItens] = useState<Midia[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberta && !d.open) d.showModal();
    if (!aberta && d.open) d.close();
  }, [aberta]);

  useEffect(() => {
    if (!aberta) return;
    let cancelado = false;
    setCarregando(true); setErro(null);
    let q = supabase.from('midias')
      .select('id, storage_path, nome_original, mime_type, texto_alternativo', { count: 'exact' })
      .eq('municipio_id', municipioId).like('mime_type', 'image/%')
      .order('criado_em', { ascending: false })
      .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
    // Busca sem acento e sem diferenciar maiúsculas; vírgula e parênteses quebrariam o filtro "or".
    const t = termo.trim().replace(/[,()%]/g, ' ').trim();
    if (t) q = q.or(`texto_alternativo.ilike.%${t}%,nome_original.ilike.%${t}%`);
    q.then(({ data, count, error }) => {
      if (cancelado) return;
      if (error) setErro(mensagemErro(error));
      setItens((data ?? []) as Midia[]); setTotal(count ?? 0); setCarregando(false);
    });
    return () => { cancelado = true; };
  }, [aberta, municipioId, termo, pagina]);

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pesquisar = (ev: React.FormEvent) => { ev.preventDefault(); setPagina(0); setTermo(busca); };

  return createPortal(
    <dialog ref={ref} className="biblioteca-midias" aria-labelledby={`${id}-titulo`} onClose={aoFechar}>
      <div className="biblioteca-topo">
        <h2 id={`${id}-titulo`}>Escolher imagem já enviada</h2>
        <button type="button" className="botao-link" onClick={aoFechar}>Fechar</button>
      </div>
      <form className="biblioteca-busca" onSubmit={pesquisar} role="search">
        <label htmlFor={`${id}-busca`}>Buscar pela descrição ou pelo nome do arquivo</label>
        <div>
          <input id={`${id}-busca`} type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex.: escola, uniforme, brasão" />
          <button type="submit" className="botao-secundario">Buscar</button>
        </div>
      </form>
      <div aria-live="polite" className="biblioteca-situacao">
        {erro ? <p className="erro" role="alert">{erro}</p>
          : carregando ? <p>Carregando…</p>
          : <p>{total === 0 ? 'Nenhuma imagem encontrada.' : `${total} ${total === 1 ? 'imagem' : 'imagens'}${termo ? ` para "${termo}"` : ''}.`}</p>}
      </div>
      <ul className="biblioteca-grade">
        {itens.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => { aoEscolher(m); aoFechar(); }}>
              <img src={urlMidia(m.storage_path)!} alt="" loading="lazy" decoding="async" />
              <span className="biblioteca-legenda">{m.texto_alternativo || m.nome_original}</span>
              <span className="sr-only">Escolher esta imagem</span>
            </button>
          </li>
        ))}
      </ul>
      {paginas > 1 && (
        <nav className="biblioteca-paginas" aria-label="Páginas da biblioteca">
          <button type="button" className="botao-secundario" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anteriores</button>
          <span>Página {pagina + 1} de {paginas}</span>
          <button type="button" className="botao-secundario" disabled={pagina + 1 >= paginas} onClick={() => setPagina(pagina + 1)}>Próximas</button>
        </nav>
      )}
    </dialog>,
    document.body,
  );
}
