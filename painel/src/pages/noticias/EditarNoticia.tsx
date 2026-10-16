// Edição de notícia/aviso, sobre a lógica comum de useEdicao (D-09, D-18).
import { useEffect, useState, type FormEvent } from 'react';
import { useEdicao, useOpcoes } from '../../lib/edicao';
import { mensagemErro, supabase, urlMidia } from '../../lib/supabase';
import { enviarMidia, type Midia } from '../../lib/midias';
import { deInputDataHora, paraInputDataHora, SLUG_VALIDO, slugificar } from '../../lib/texto';
import { usePortal } from '../../lib/portal';
import { useUnidadesNoticia } from '../../lib/unidadesNoticia';
import { EditorTexto } from '../../components/EditorTexto';
import { CampoImagem } from '../../components/CampoImagem';
import { BibliotecaMidias } from '../../components/BibliotecaMidias';
import { BarraAcoes, CabecalhoEdicao, CampoSlug, CarregandoOuAusente, MensagensEdicao, Obrigatorio, SeletorOrgao } from '../../components/Edicao';

interface ItemGaleria { midia: Midia; legenda: string | null; ordem: number }
const CAMPOS_MIDIA = 'id, storage_path, nome_original, mime_type, texto_alternativo';

interface Form {
  tipo: 'noticia' | 'aviso'; titulo: string; slug: string; resumo: string; corpo: string;
  imagem: Midia | null; cats: string[]; orgaoId: string; destaque: boolean; expiraEm: string; unidadeId: string;
}

export function EditarNoticia() {
  const portal = usePortal();
  const { categorias, orgaos } = useOpcoes('publicacao');
  const unidades = useUnidadesNoticia();
  const [slugManual, setSlugManual] = useState(false);
  const [galeria, setGaleria] = useState<ItemGaleria[]>([]);

  const e = useEdicao<Form>({
    tabela: 'publicacoes',
    rotaBase: '/noticias',
    select: `*, imagem:midias!publicacoes_imagem_destaque_id_municipio_id_fkey(${CAMPOS_MIDIA}),
      cats:publicacao_categorias(categoria_id),
      galeria:publicacao_midias(legenda, ordem, midia:midias(${CAMPOS_MIDIA}))`,
    vazio: { tipo: 'noticia', titulo: '', slug: '', resumo: '', corpo: '', imagem: null, cats: [], orgaoId: '', destaque: false, expiraEm: '', unidadeId: '' },
    deLinha: (d) => ({
      tipo: d.tipo, titulo: d.titulo, slug: d.slug, resumo: d.resumo ?? '', corpo: d.corpo_html ?? '', imagem: d.imagem ?? null,
      cats: (d.cats ?? []).map((c: { categoria_id: string }) => c.categoria_id), orgaoId: d.orgao_id ?? '',
      destaque: d.destaque, expiraEm: paraInputDataHora(d.expira_em), unidadeId: d.unidade_id ?? '',
    }),
    paraLinha: (f) => ({
      tipo: f.tipo, titulo: f.titulo.trim(), slug: f.slug, resumo: f.resumo.trim() || null, corpo_html: f.corpo || null,
      imagem_destaque_id: f.imagem?.id ?? null, destaque: f.destaque, orgao_id: f.orgaoId || null, expira_em: deInputDataHora(f.expiraEm),
      unidade_id: f.unidadeId || null,
    }),
    validar: (f) => [
      !f.titulo.trim() && 'Informe o título.',
      !SLUG_VALIDO.test(f.slug) && 'O endereço só pode ter letras minúsculas, números e hífens.',
      f.imagem && !f.imagem.texto_alternativo?.trim() && 'A imagem de destaque precisa de texto alternativo.',
      unidades.soUnidade && !f.unidadeId && 'Escolha a unidade da notícia.',
    ].filter(Boolean) as string[],
    podePublicarRegistro: (f) => unidades.podePublicarNa(f.unidadeId),
    aposSalvar: async (id, f) => {
      // Categorias: remove as desmarcadas e inclui as novas.
      const del = supabase.from('publicacao_categorias').delete().eq('publicacao_id', id);
      const d = f.cats.length ? await del.not('categoria_id', 'in', `(${f.cats.join(',')})`) : await del;
      if (d.error) throw d.error;
      if (f.cats.length) {
        const ins = await supabase.from('publicacao_categorias')
          .upsert(f.cats.map((c) => ({ publicacao_id: id, categoria_id: c })), { onConflict: 'publicacao_id,categoria_id', ignoreDuplicates: true });
        if (ins.error) throw ins.error;
      }
    },
    mensagens: { salvar: 'Alterações salvas.', publicar: 'Notícia publicada.', agendar: 'Publicação agendada para', despublicar: 'Notícia retirada do site.' },
  });
  const { f, mudar } = e;

  useEffect(() => { if (e.linha) { setSlugManual(true); setGaleria(((e.linha.galeria ?? []) as ItemGaleria[]).sort((a, b) => a.ordem - b.ordem)); } }, [e.linha]);
  useEffect(() => { if (!slugManual) mudar('slug', slugificar(f.titulo)); }, [f.titulo, slugManual, mudar]);
  // Quem só escreve na unidade: notícia nova já vem com a primeira (ou única) unidade dele.
  useEffect(() => {
    if (e.nova && unidades.soUnidade && !f.unidadeId && unidades.opcoes.length) mudar('unidadeId', unidades.opcoes[0].id);
  }, [e.nova, unidades.soUnidade, unidades.opcoes, f.unidadeId, mudar]);

  async function adicionarFoto(arquivo: File, alt: string, legenda: string) {
    const m = await enviarMidia(e.mid, arquivo, alt);
    const ordem = galeria.length ? Math.max(...galeria.map((g) => g.ordem)) + 1 : 0;
    const { error } = await supabase.from('publicacao_midias').insert({ municipio_id: e.mid, publicacao_id: e.id, midia_id: m.id, legenda: legenda || null, ordem });
    if (error) throw error;
    setGaleria([...galeria, { midia: m, legenda: legenda || null, ordem }]);
  }
  /** Foto já enviada, escolhida na biblioteca (D-92): só cria o vínculo com a notícia. */
  async function adicionarExistente(m: Midia, legenda: string) {
    if (galeria.some((g) => g.midia.id === m.id)) throw new Error('Esta foto já está na galeria.');
    const ordem = galeria.length ? Math.max(...galeria.map((g) => g.ordem)) + 1 : 0;
    const { error } = await supabase.from('publicacao_midias').insert({ municipio_id: e.mid, publicacao_id: e.id, midia_id: m.id, legenda: legenda || null, ordem });
    if (error) throw error;
    setGaleria([...galeria, { midia: m, legenda: legenda || null, ordem }]);
  }
  async function removerFoto(midiaId: string) {
    const { error } = await supabase.from('publicacao_midias').delete().eq('publicacao_id', e.id).eq('midia_id', midiaId);
    if (error) e.setErro(mensagemErro(error)); else setGaleria(galeria.filter((g) => g.midia.id !== midiaId));
  }

  const enviar = (ev: FormEvent) => { ev.preventDefault(); e.salvar('salvar'); };
  return (
    <CarregandoOuAusente e={e} rotuloLista="Notícias e avisos">
      <form onSubmit={enviar} className="formulario-conteudo" noValidate>
        <CabecalhoEdicao e={e} rotuloLista="Notícias e avisos" titulo={e.nova ? 'Nova notícia' : f.titulo || 'Sem título'}
          linkSite={portal && `${portal}/noticias/${f.slug}`} previa={{ tabela: 'publicacoes', portal }} />
        <MensagensEdicao e={e} nome="notícia" />
        <fieldset disabled={e.bloqueado || e.salvando} className="grade-formulario">
          <div className="coluna-principal">
            <label><Obrigatorio>Título</Obrigatorio><input required value={f.titulo} onChange={(ev) => mudar('titulo', ev.target.value)} maxLength={200} /></label>
            <CampoSlug prefixo="/noticias/" valor={f.slug} travado={e.jaPublicado} aoMudar={(v) => { setSlugManual(true); mudar('slug', v); }} />
            <div className="campo"><label>Resumo
              <textarea value={f.resumo} onChange={(ev) => mudar('resumo', ev.target.value)} rows={3} maxLength={300} aria-describedby="ajuda-resumo" /></label>
              <small id="ajuda-resumo">Aparece na lista de notícias, no Google e na prévia do WhatsApp. {f.resumo.length}/300</small>
            </div>
            <div className="campo">
              <span className="rotulo-campo">Texto</span>
              <EditorTexto rotulo="Texto da notícia" valor={f.corpo} aoMudar={(v) => mudar('corpo', v)} municipioId={e.mid} desabilitado={e.bloqueado} />
            </div>
          </div>
          <div className="coluna-lateral">
            <label>Tipo
              <select value={f.tipo} onChange={(ev) => mudar('tipo', ev.target.value as Form['tipo'])}>
                <option value="noticia">Notícia</option>
                <option value="aviso">Aviso</option>
              </select>
            </label>
            <CampoImagem rotulo="Imagem de destaque" municipioId={e.mid} midia={f.imagem} aoMudar={(m) => mudar('imagem', m)} desabilitado={e.bloqueado} />
            <fieldset>
              <legend>Categorias</legend>
              {categorias.length === 0 ? <p className="meta">Nenhuma categoria cadastrada.</p> : categorias.map((c) => (
                <label key={c.id} className="opcao">
                  <input type="checkbox" checked={f.cats.includes(c.id)}
                    onChange={(ev) => mudar('cats', ev.target.checked ? [...f.cats, c.id] : f.cats.filter((x) => x !== c.id))} /> {c.nome}
                </label>
              ))}
            </fieldset>
            {(unidades.soUnidade || unidades.todas.length > 0) && (
              <div className="campo"><label>{unidades.soUnidade ? <Obrigatorio>Unidade</Obrigatorio> : 'Unidade (opcional)'}
                <select value={f.unidadeId} onChange={(ev) => mudar('unidadeId', ev.target.value)} aria-describedby="ajuda-unidade">
                  {!unidades.soUnidade && <option value="">Nenhuma: notícia da organização</option>}
                  {unidades.soUnidade && !f.unidadeId && <option value="">Escolha…</option>}
                  {(unidades.soUnidade ? unidades.opcoes : unidades.todas).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select></label>
                <small id="ajuda-unidade">{unidades.soUnidade
                  ? 'Você escreve as notícias da sua unidade.'
                  : 'Marque a escola ou unidade quando a notícia for dela: a equipe da unidade passa a poder editá-la.'}</small>
              </div>
            )}
            <SeletorOrgao orgaos={orgaos} valor={f.orgaoId} aoMudar={(v) => mudar('orgaoId', v)} />
            {!unidades.soUnidade && <label className="opcao"><input type="checkbox" checked={f.destaque} onChange={(ev) => mudar('destaque', ev.target.checked)} /> Destacar na página inicial</label>}
            <div className="campo"><label>Sair das listagens em (opcional)
              <input type="datetime-local" value={f.expiraEm} onChange={(ev) => mudar('expiraEm', ev.target.value)} aria-describedby="ajuda-expira" /></label>
              <small id="ajuda-expira">Útil para avisos com prazo. Depois da data, some da home e da lista, mas o link continua funcionando.</small>
            </div>
          </div>
        </fieldset>
        {e.nova
          ? <p className="meta">Salve o rascunho para adicionar uma galeria de fotos.</p>
          : <Galeria itens={galeria} bloqueada={e.bloqueado} municipioId={e.mid} aoAdicionar={adicionarFoto} aoAdicionarExistente={adicionarExistente} aoRemover={removerFoto} />}
        <BarraAcoes e={e} />
      </form>
    </CarregandoOuAusente>
  );
}

function Galeria({ itens, bloqueada, municipioId, aoAdicionar, aoAdicionarExistente, aoRemover }: {
  itens: ItemGaleria[]; bloqueada: boolean; municipioId: string;
  aoAdicionar: (f: File, alt: string, legenda: string) => Promise<void>;
  aoAdicionarExistente: (m: Midia, legenda: string) => Promise<void>; aoRemover: (midiaId: string) => void;
}) {
  const [biblioteca, setBiblioteca] = useState(false);
  async function escolher(m: Midia) {
    setErro(null);
    try { await aoAdicionarExistente(m, legenda.trim()); setLegenda(''); }
    catch (err) { setErro(mensagemErro(err)); }
  }
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [alt, setAlt] = useState('');
  const [legenda, setLegenda] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function adicionar() {
    if (!arquivo) return;
    if (!alt.trim()) { setErro('Descreva a foto (texto alternativo).'); return; }
    setEnviando(true); setErro(null);
    try { await aoAdicionar(arquivo, alt.trim(), legenda.trim()); setArquivo(null); setAlt(''); setLegenda(''); }
    catch (err) { setErro(mensagemErro(err)); }
    setEnviando(false);
  }

  return (
    <section className="galeria-editor" aria-labelledby="t-galeria">
      <h2 id="t-galeria">Galeria de fotos</h2>
      {itens.length === 0 ? <p className="meta">Nenhuma foto na galeria.</p> : (
        <ul>
          {itens.map((g) => (
            <li key={g.midia.id}>
              <img src={urlMidia(g.midia.storage_path)!} alt={g.midia.texto_alternativo ?? ''} />
              {g.legenda && <span>{g.legenda}</span>}
              {!bloqueada && <button type="button" className="botao-link" onClick={() => aoRemover(g.midia.id)}>Remover<span className="sr-only"> foto {g.midia.texto_alternativo}</span></button>}
            </li>
          ))}
        </ul>
      )}
      {!bloqueada && (
        <fieldset className="nova-foto">
          <legend>Adicionar foto</legend>
          <div className="imagem-opcoes">
            <button type="button" className="botao-secundario" onClick={() => setBiblioteca(true)}>Escolher da biblioteca</button>
            <span>ou envie um arquivo novo:</span>
          </div>
          <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Arquivo da foto" onChange={(ev) => setArquivo(ev.target.files?.[0] ?? null)} />
          {arquivo && (
            <>
              <label>Descrição da foto (texto alternativo, obrigatório)<input value={alt} onChange={(ev) => setAlt(ev.target.value)} /></label>
              <label>Legenda (opcional)<input value={legenda} onChange={(ev) => setLegenda(ev.target.value)} /></label>
              <button type="button" className="botao-secundario" onClick={adicionar} disabled={enviando}>{enviando ? 'Enviando…' : 'Adicionar à galeria'}</button>
            </>
          )}
          {erro && <p className="erro" role="alert">{erro}</p>}
          <BibliotecaMidias municipioId={municipioId} aberta={biblioteca} aoFechar={() => setBiblioteca(false)} aoEscolher={escolher} />
        </fieldset>
      )}
    </section>
  );
}
