// Documentos e legislação: leis, decretos, portarias, licitações, contratos, concursos...
// O tipo vem da categoria (D-04); campos próprios de cada tipo ficam em `metadados`.
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ListaConteudo } from '../../components/ListaConteudo';
import { useEdicao, useOpcoes, type Edicao } from '../../lib/edicao';
import { mensagemErro, supabase, urlMidia } from '../../lib/supabase';
import { enviarMidia } from '../../lib/midias';
import { SLUG_VALIDO, slugificar } from '../../lib/texto';
import { usePortal } from '../../lib/portal';
import { EditorTexto } from '../../components/EditorTexto';
import { BarraAcoes, CabecalhoEdicao, CampoSlug, CarregandoOuAusente, MensagensEdicao, Obrigatorio, SeletorOrgao } from '../../components/Edicao';

const SITUACOES: [string, string][] = [
  ['vigente', 'Vigente'], ['alterado', 'Alterado'], ['revogado', 'Revogado'], ['suspenso', 'Suspenso'], ['sem_efeito', 'Sem efeito'],
];
const RELACOES: [string, string][] = [
  ['revoga', 'Revoga'], ['revoga_parcialmente', 'Revoga parcialmente'], ['altera', 'Altera'], ['regulamenta', 'Regulamenta'],
  ['retifica', 'Retifica'], ['republica', 'Republica'], ['prorroga', 'Prorroga'], ['referencia', 'Faz referência a'],
];
// Sugestões de campos extras por tipo de documento (o município pode usar outros).
const CAMPOS_SUGERIDOS: Record<string, string[]> = {
  licitacoes: ['modalidade', 'numero_processo', 'situacao_licitacao', 'data_abertura', 'valor_estimado', 'objeto'],
  contratos: ['contratada', 'cnpj_contratada', 'valor', 'vigencia', 'numero_processo'],
  'atas-registro-precos': ['fornecedor', 'vigencia', 'numero_processo'],
  'concursos-publicos': ['situacao_concurso', 'inscricoes', 'banca'],
  'processos-seletivos': ['situacao_processo', 'inscricoes'],
  convenios: ['concedente', 'valor', 'vigencia'],
};
const NORMATIVOS = ['lei-organica', 'leis-complementares', 'leis-ordinarias', 'decretos', 'portarias', 'resolucoes'];

export function ListaDocumentos() {
  const { categorias } = useOpcoes('documento');
  const [cat, setCat] = useState('');
  return (
    <ListaConteudo
      titulo="Documentos e legislação" tabela="documentos" rotaBase="/documentos" rotuloNovo="Novo documento"
      select="titulo, numero, ano, data_documento, situacao, atualizado_em, categoria:categorias(nome)" campoTitulo="titulo"
      ordem={[{ coluna: 'atualizado_em' }]}
      filtro={cat ? (q) => q.eq('categoria_id', cat) : undefined} chaveFiltro={cat}
      acima={(
        <label>Tipo
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Todos</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
      )}
      colunas={[
        { rotulo: 'Título', render: (l) => l.titulo },
        { rotulo: 'Tipo', render: (l) => l.categoria?.nome ?? '—' },
        { rotulo: 'Data', render: (l) => l.data_documento ? new Date(`${l.data_documento}T12:00:00`).toLocaleDateString('pt-BR') : '—' },
        { rotulo: 'Vigência', render: (l) => SITUACOES.find(([v]) => v === l.situacao)?.[1] ?? '—' },
      ]}
      vazio="Nenhum documento encontrado."
    />
  );
}

interface Form {
  categoriaId: string; titulo: string; slug: string; numero: string; ano: string; dataDocumento: string;
  ementa: string; descricao: string; situacao: string; orgaoId: string; metadados: { chave: string; valor: string }[];
}

export function EditarDocumento() {
  const portal = usePortal();
  const { categorias, orgaos } = useOpcoes('documento');
  const [slugManual, setSlugManual] = useState(false);

  const e = useEdicao<Form>({
    tabela: 'documentos',
    rotaBase: '/documentos',
    select: `*,
      arquivos:documento_arquivos(id, rotulo, url_externa, ordem, midia:midias(id, storage_path, nome_original, mime_type)),
      relacoes:documento_relacoes!documento_relacoes_documento_id_municipio_id_fkey(id, tipo, alvo:documentos!documento_relacoes_relacionado_id_municipio_id_fkey(id, titulo))`,
    vazio: { categoriaId: '', titulo: '', slug: '', numero: '', ano: '', dataDocumento: '', ementa: '', descricao: '', situacao: '', orgaoId: '', metadados: [] },
    deLinha: (d) => ({
      categoriaId: d.categoria_id ?? '', titulo: d.titulo, slug: d.slug, numero: d.numero ?? '', ano: d.ano ? String(d.ano) : '',
      dataDocumento: d.data_documento ?? '', ementa: d.ementa ?? '', descricao: d.descricao_html ?? '', situacao: d.situacao ?? '',
      orgaoId: d.orgao_id ?? '',
      metadados: Object.entries(d.metadados ?? {}).map(([chave, valor]) => ({ chave, valor: String(valor ?? '') })),
    }),
    paraLinha: (f) => ({
      categoria_id: f.categoriaId || null, titulo: f.titulo.trim(), slug: f.slug, numero: f.numero.trim() || null,
      ano: f.ano ? Number(f.ano) : (f.dataDocumento ? Number(f.dataDocumento.slice(0, 4)) : null),
      data_documento: f.dataDocumento || null, ementa: f.ementa.trim() || null, descricao_html: f.descricao || null,
      situacao: f.situacao || null, orgao_id: f.orgaoId || null,
      metadados: Object.fromEntries(f.metadados.filter((m) => m.chave.trim() && m.valor.trim()).map((m) => [chaveMeta(m.chave), m.valor.trim()])),
    }),
    validar: (f) => [
      !f.categoriaId && 'Escolha o tipo do documento.',
      !f.titulo.trim() && 'Informe o título.',
      !SLUG_VALIDO.test(f.slug) && 'O endereço só pode ter letras minúsculas, números e hífens.',
      f.ano && !/^\d{4}$/.test(f.ano) && 'O ano deve ter 4 dígitos.',
    ].filter(Boolean) as string[],
    mensagens: { salvar: 'Alterações salvas.', publicar: 'Documento publicado.', agendar: 'Publicação agendada para', despublicar: 'Documento retirado do site.' },
  });
  const { f, mudar } = e;
  const slugCat = categorias.find((c) => c.id === f.categoriaId)?.slug ?? '';
  const sugeridos = (CAMPOS_SUGERIDOS[slugCat] ?? []).filter((s) => !f.metadados.some((m) => chaveMeta(m.chave) === s));

  useEffect(() => { if (e.linha) setSlugManual(true); }, [e.linha]);
  useEffect(() => { if (!slugManual) mudar('slug', slugificar(f.titulo)); }, [f.titulo, slugManual, mudar]);

  const enviar = (ev: FormEvent) => { ev.preventDefault(); e.salvar('salvar'); };
  return (
    <CarregandoOuAusente e={e} rotuloLista="Documentos">
      <form onSubmit={enviar} className="formulario-conteudo" noValidate>
        <CabecalhoEdicao e={e} rotuloLista="Documentos e legislação" titulo={e.nova ? 'Novo documento' : f.titulo || 'Sem título'}
          linkSite={portal && `${portal}/documentos/${f.slug}`} />
        <MensagensEdicao e={e} nome="documento" />
        <fieldset disabled={e.bloqueado || e.salvando} className="grade-formulario">
          <div className="coluna-principal">
            <label><Obrigatorio>Tipo</Obrigatorio>
              <select value={f.categoriaId} onChange={(ev) => mudar('categoriaId', ev.target.value)} required>
                <option value="">Escolha…</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <label><Obrigatorio>Título</Obrigatorio>
              <input value={f.titulo} onChange={(ev) => mudar('titulo', ev.target.value)} maxLength={250} placeholder="Ex.: Lei Municipal nº 10/2026" />
            </label>
            <CampoSlug prefixo="/documentos/" valor={f.slug} travado={e.jaPublicado} aoMudar={(v) => { setSlugManual(true); mudar('slug', v); }} />
            <div className="linha-campos">
              <label>Número<input value={f.numero} onChange={(ev) => mudar('numero', ev.target.value)} maxLength={30} /></label>
              <label>Ano<input inputMode="numeric" value={f.ano} onChange={(ev) => mudar('ano', ev.target.value.replace(/\D/g, '').slice(0, 4))} /></label>
              <label>Data do documento<input type="date" value={f.dataDocumento} onChange={(ev) => mudar('dataDocumento', ev.target.value)} /></label>
            </div>
            <div className="campo"><label>Ementa
              <textarea rows={3} value={f.ementa} onChange={(ev) => mudar('ementa', ev.target.value)} aria-describedby="ajuda-ementa" /></label>
              <small id="ajuda-ementa">Resumo oficial do ato. Aparece na busca e no Google.</small>
            </div>
            <div className="campo">
              <span className="rotulo-campo">Descrição ou texto do ato (opcional)</span>
              <EditorTexto rotulo="Descrição do documento" valor={f.descricao} aoMudar={(v) => mudar('descricao', v)} municipioId={e.mid} desabilitado={e.bloqueado} />
            </div>
          </div>
          <div className="coluna-lateral">
            <div className="campo"><label>Situação de vigência
              <select value={f.situacao} onChange={(ev) => mudar('situacao', ev.target.value)} aria-describedby="ajuda-situacao">
                <option value="">Não se aplica</option>
                {SITUACOES.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select></label>
              <small id="ajuda-situacao">{NORMATIVOS.includes(slugCat) && !f.situacao ? 'Recomendado para leis, decretos e portarias.' : 'Para atos normativos.'}</small>
            </div>
            <SeletorOrgao orgaos={orgaos} valor={f.orgaoId} aoMudar={(v) => mudar('orgaoId', v)} />
            <fieldset>
              <legend>Campos adicionais</legend>
              {f.metadados.map((m, i) => (
                <div key={i} className="par-chave-valor">
                  <input aria-label={`Nome do campo ${i + 1}`} value={m.chave} placeholder="campo"
                    onChange={(ev) => mudar('metadados', f.metadados.map((x, j) => j === i ? { ...x, chave: ev.target.value } : x))} />
                  <input aria-label={`Valor do campo ${m.chave || i + 1}`} value={m.valor} placeholder="valor"
                    onChange={(ev) => mudar('metadados', f.metadados.map((x, j) => j === i ? { ...x, valor: ev.target.value } : x))} />
                  <button type="button" className="botao-link" onClick={() => mudar('metadados', f.metadados.filter((_, j) => j !== i))}>Remover<span className="sr-only"> campo {m.chave}</span></button>
                </div>
              ))}
              <p className="acoes-linha">
                <button type="button" className="botao-link" onClick={() => mudar('metadados', [...f.metadados, { chave: '', valor: '' }])}>+ Campo</button>
                {sugeridos.map((s) => (
                  <button key={s} type="button" className="botao-link" onClick={() => mudar('metadados', [...f.metadados, { chave: s, valor: '' }])}>+ {s.replace(/_/g, ' ')}</button>
                ))}
              </p>
            </fieldset>
          </div>
        </fieldset>
        {e.nova
          ? <p className="meta">Salve o rascunho para anexar arquivos e registrar atos relacionados.</p>
          : <><Arquivos e={e} /><Relacoes e={e} /></>}
        <BarraAcoes e={e} />
      </form>
    </CarregandoOuAusente>
  );
}

function chaveMeta(k: string) {
  return k.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

interface Arquivo { id: string; rotulo: string; url_externa: string | null; ordem: number; midia: { id: string; storage_path: string; nome_original: string; mime_type: string } | null }

function Arquivos({ e }: { e: Edicao<Form> }) {
  const [lista, setLista] = useState<Arquivo[]>([]);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [rotulo, setRotulo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { setLista(((e.linha?.arquivos ?? []) as Arquivo[]).sort((a, b) => a.ordem - b.ordem)); }, [e.linha]);

  async function adicionar() {
    setErro(null);
    if (!rotulo.trim()) return setErro('Dê um nome ao arquivo (ex.: "Edital completo").');
    if (!arquivo && !/^https?:\/\//.test(url.trim())) return setErro('Escolha um arquivo ou informe um endereço começando com https://.');
    setEnviando(true);
    try {
      const midia = arquivo ? await enviarMidia(e.mid, arquivo, null) : null;
      const ordem = lista.length ? Math.max(...lista.map((a) => a.ordem)) + 1 : 0;
      const { data, error } = await supabase.from('documento_arquivos')
        .insert({ documento_id: e.id, midia_id: midia?.id ?? null, url_externa: midia ? null : url.trim(), rotulo: rotulo.trim(), ordem })
        .select('id, rotulo, url_externa, ordem, midia:midias(id, storage_path, nome_original, mime_type)').single();
      if (error) throw error;
      setLista([...lista, data as unknown as Arquivo]);
      setArquivo(null); setUrl(''); setRotulo('');
    } catch (err) { setErro(mensagemErro(err)); }
    setEnviando(false);
  }
  async function remover(id: string) {
    const { error } = await supabase.from('documento_arquivos').delete().eq('id', id);
    if (error) setErro(mensagemErro(error)); else setLista(lista.filter((a) => a.id !== id));
  }
  async function mover(i: number, d: -1 | 1) {
    const n = [...lista]; const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    const comOrdem = n.map((a, k) => ({ ...a, ordem: k }));
    setLista(comOrdem);
    for (const a of comOrdem) await supabase.from('documento_arquivos').update({ ordem: a.ordem }).eq('id', a.id);
  }

  return (
    <section className="secao-filha" aria-labelledby="t-arquivos">
      <h2 id="t-arquivos">Arquivos</h2>
      {lista.length === 0 ? <p className="meta">Nenhum arquivo anexado.</p> : (
        <ol className="lista-filhos">
          {lista.map((a, i) => (
            <li key={a.id}>
              <a href={a.midia ? urlMidia(a.midia.storage_path)! : a.url_externa!} target="_blank" rel="noopener">{a.rotulo}</a>
              <span className="meta">{a.midia ? a.midia.nome_original : 'link externo'}</span>
              {!e.bloqueado && (
                <span className="acoes-linha">
                  <button type="button" className="botao-link" disabled={i === 0} onClick={() => mover(i, -1)}>Subir<span className="sr-only"> {a.rotulo}</span></button>
                  <button type="button" className="botao-link" disabled={i === lista.length - 1} onClick={() => mover(i, 1)}>Descer<span className="sr-only"> {a.rotulo}</span></button>
                  <button type="button" className="botao-link" onClick={() => remover(a.id)}>Remover<span className="sr-only"> {a.rotulo}</span></button>
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      {!e.bloqueado && (
        <fieldset className="nova-foto">
          <legend>Anexar</legend>
          <label>Nome do arquivo no site<input value={rotulo} onChange={(ev) => setRotulo(ev.target.value)} placeholder="Ex.: Edital completo, Anexo I, Ata de julgamento" /></label>
          <label>Arquivo (PDF, até 20 MB)<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,.zip,image/*" onChange={(ev) => setArquivo(ev.target.files?.[0] ?? null)} /></label>
          {!arquivo && <label>ou endereço externo<input type="url" value={url} onChange={(ev) => setUrl(ev.target.value)} placeholder="https://" /></label>}
          <button type="button" className="botao-secundario" onClick={adicionar} disabled={enviando}>{enviando ? 'Enviando…' : 'Anexar'}</button>
          {erro && <p className="erro" role="alert">{erro}</p>}
        </fieldset>
      )}
    </section>
  );
}

interface Relacao { id: string; tipo: string; alvo: { id: string; titulo: string } | null }

function Relacoes({ e }: { e: Edicao<Form> }) {
  const [lista, setLista] = useState<Relacao[]>([]);
  const [tipo, setTipo] = useState('revoga');
  const [busca, setBusca] = useState('');
  const [opcoes, setOpcoes] = useState<{ id: string; titulo: string }[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { setLista((e.linha?.relacoes ?? []) as Relacao[]); }, [e.linha]);

  useEffect(() => {
    if (busca.trim().length < 2) { setOpcoes([]); return; }
    const t = setTimeout(() => {
      supabase.from('documentos').select('id, titulo').eq('municipio_id', e.mid).neq('id', e.id!)
        .ilike('titulo', `%${busca.trim().replace(/[%_\\]/g, '\\$&')}%`).order('titulo').limit(8)
        .then(({ data }) => setOpcoes(data ?? []));
    }, 250);
    return () => clearTimeout(t);
  }, [busca, e.mid, e.id]);

  async function adicionar(alvo: { id: string; titulo: string }) {
    setErro(null);
    const { data, error } = await supabase.from('documento_relacoes')
      .insert({ municipio_id: e.mid, documento_id: e.id, relacionado_id: alvo.id, tipo }).select('id, tipo').single();
    if (error) return setErro(mensagemErro(error));
    setLista([...lista, { ...(data as { id: string; tipo: string }), alvo }]);
    setBusca(''); setOpcoes([]);
  }
  async function remover(id: string) {
    const { error } = await supabase.from('documento_relacoes').delete().eq('id', id);
    if (error) setErro(mensagemErro(error)); else setLista(lista.filter((r) => r.id !== id));
  }

  return (
    <section className="secao-filha" aria-labelledby="t-relacoes">
      <h2 id="t-relacoes">Atos relacionados</h2>
      <p className="meta">Ex.: esta lei <em>revoga</em> a Lei nº 3/2001. Lembre de atualizar a situação de vigência do ato revogado.</p>
      {lista.length > 0 && (
        <ul className="lista-filhos">
          {lista.map((r) => (
            <li key={r.id}>
              {RELACOES.find(([v]) => v === r.tipo)?.[1] ?? r.tipo}:{' '}
              {r.alvo ? <Link to={`/documentos/${r.alvo.id}`}>{r.alvo.titulo}</Link> : <em>documento sem acesso</em>}
              {!e.bloqueado && <button type="button" className="botao-link" onClick={() => remover(r.id)}>Remover<span className="sr-only"> relação</span></button>}
            </li>
          ))}
        </ul>
      )}
      {!e.bloqueado && (
        <fieldset className="nova-foto">
          <legend>Nova relação</legend>
          <div className="linha-campos">
            <label>Este documento
              <select value={tipo} onChange={(ev) => setTipo(ev.target.value)}>{RELACOES.map(([v, r]) => <option key={v} value={v}>{r.toLowerCase()}</option>)}</select>
            </label>
            <label>Buscar documento<input type="search" value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Digite parte do título" /></label>
          </div>
          {opcoes.length > 0 && (
            <ul className="lista-filhos" aria-label="Resultados">
              {opcoes.map((o) => <li key={o.id}><button type="button" className="botao-link" onClick={() => adicionar(o)}>{o.titulo}</button></li>)}
            </ul>
          )}
          {erro && <p className="erro" role="alert">{erro}</p>}
        </fieldset>
      )}
    </section>
  );
}
