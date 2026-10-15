// Unidades (escolas, creches, UBS...) e regiões da organização (0018/0019, D-38).
// Quem tem unidades.gerenciar cadastra, exclui e organiza (região, supervisor, situação, tipo, INEP, ordem).
// Quem tem só unidades.editar (ex.: diretor, escopo unidade) atualiza contato, endereço, foto e etapas
// da própria unidade; o banco recusa o resto (gatilho checar_campos_unidade).
// Tipos e etapas são livres por organização (D-10): o formulário sugere os já usados.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { mensagemErro, supabase } from '../../lib/supabase';
import { slugificar, SLUG_VALIDO } from '../../lib/texto';
import type { Midia } from '../../lib/midias';
import { CampoImagem } from '../../components/CampoImagem';
import { Obrigatorio } from '../../components/Edicao';

// Rótulos conhecidos; valores novos aparecem como foram gravados.
const ROTULO_TIPO: Record<string, string> = {
  escola: 'Escola', creche: 'Creche', emei: 'EMEI', emef: 'EMEF', emefi: 'EMEFI', emefm: 'EMEFM', em: 'Escola municipal',
  supletivo: 'Supletivo', tecnica: 'Escola técnica', conveniada: 'Conveniada', administrativa: 'Unidade administrativa', ubs: 'UBS',
};
const ROTULO_ETAPA: Record<string, string> = {
  creche: 'Creche', pre_escola: 'Pré-escola', fundamental: 'Ensino Fundamental', fundamental_1: 'Fundamental (anos iniciais)',
  fundamental_2: 'Fundamental (anos finais)', medio: 'Ensino Médio', tecnico: 'Técnico', eja: 'EJA', educacao_especial: 'Educação especial',
};
const rotuloTipo = (t: string) => ROTULO_TIPO[t] ?? t;
const rotuloEtapa = (e: string) => ROTULO_ETAPA[e] ?? e.replace(/_/g, ' ');

interface UnidadeLista { id: string; nome: string; sigla: string | null; tipo: string; bairro: string | null; regiao_id: string | null; supervisor_id: string | null; ativo: boolean; legado: any }
interface Opcao { id: string; nome: string }

/** Unidades que a pessoa pode editar quando não gerencia a rede (escopo unidade/região do vínculo). */
function useAlcance() {
  const { podeNaRede, permissoes, pode } = useAuth();
  const gerencia = pode('unidades.gerenciar');
  const todas = gerencia || podeNaRede('unidades.editar');
  const minhasUnidades = permissoes.filter((p) => p.permissao === 'unidades.editar' && p.escopo === 'unidade' && p.unidade_id).map((p) => p.unidade_id!);
  const minhasRegioes = permissoes.filter((p) => p.permissao === 'unidades.editar' && p.escopo === 'regiao' && p.regiao_id).map((p) => p.regiao_id!);
  const alcanca = (u: { id: string; regiao_id: string | null }) => todas || minhasUnidades.includes(u.id) || (!!u.regiao_id && minhasRegioes.includes(u.regiao_id));
  return { gerencia, alcanca };
}

export function ListaUnidades() {
  const { atual } = useAuth();
  const mid = atual!.municipio.id;
  const { gerencia, alcanca } = useAlcance();
  const [lista, setLista] = useState<UnidadeLista[] | null>(null);
  const [regioes, setRegioes] = useState<Opcao[]>([]);
  const [supervisores, setSupervisores] = useState<Opcao[]>([]);
  const [busca, setBusca] = useState('');
  const [regiao, setRegiao] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [u, r, s] = await Promise.all([
      supabase.from('unidades').select('id, nome, sigla, tipo, bairro, regiao_id, supervisor_id, ativo, legado').eq('municipio_id', mid).order('ordem').order('nome'),
      supabase.from('regioes').select('id, nome').eq('municipio_id', mid).order('ordem').order('nome'),
      supabase.from('equipe').select('id, nome').eq('municipio_id', mid).eq('nivel', 2).order('ordem').order('nome'),
    ]);
    if (u.error) setErro(mensagemErro(u.error));
    setLista(u.data ?? []); setRegioes(r.data ?? []); setSupervisores(s.data ?? []);
  }, [mid]);
  useEffect(() => { carregar(); }, [carregar]);

  const termo = busca.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const norm = (s: string | null) => (s ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const visiveis = (lista ?? []).filter(alcanca)
    .filter((u) => !regiao || (regiao === '-' ? !u.regiao_id : u.regiao_id === regiao))
    .filter((u) => !termo || norm(u.nome).includes(termo) || norm(u.sigla).includes(termo) || norm(u.bairro).includes(termo));
  const aConfirmar = (lista ?? []).filter((u) => u.legado?.confirmar).length;

  return (
    <>
      <div className="cabecalho-tela">
        <h1>Unidades</h1>
        {gerencia && <Link className="botao" to="/unidades/nova">Nova unidade</Link>}
      </div>
      <p className="meta">Escolas, creches e demais unidades da rede, com região e supervisor responsável. A busca "Fale com o supervisor" do portal usa estes dados.</p>
      {aConfirmar > 0 && gerencia && <p className="aviso-bloqueio" role="note">{aConfirmar} unidade(s) com dados a confirmar com a Secretaria (marcadas abaixo).</p>}
      {erro && <p className="erro" role="alert">{erro}</p>}
      {gerencia && <Regioes mid={mid} regioes={regioes} aoMudar={carregar} />}
      <form className="filtros" role="search" onSubmit={(e) => e.preventDefault()}>
        <label>Buscar (nome, sigla ou bairro)<input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
        {regioes.length > 0 && (
          <label>Região
            <select value={regiao} onChange={(e) => setRegiao(e.target.value)}>
              <option value="">Todas</option><option value="-">Sem região</option>
              {regioes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </label>
        )}
      </form>
      {!lista ? <p role="status">Carregando…</p> : visiveis.length === 0 ? <p>Nenhuma unidade encontrada.</p> : (
        <table className="tabela">
          <caption className="sr-only">Unidades, {visiveis.length} na lista</caption>
          <thead><tr><th scope="col">Unidade</th><th scope="col">Tipo</th><th scope="col">Bairro</th><th scope="col">Região</th><th scope="col">Supervisor</th><th scope="col">Situação</th></tr></thead>
          <tbody>{visiveis.map((u) => (
            <tr key={u.id} className={u.ativo ? undefined : 'inativo'}>
              <td><Link to={`/unidades/${u.id}`}>{u.nome}</Link>{u.legado?.confirmar && <span className="etiqueta etiqueta-destaque"> a confirmar</span>}</td>
              <td>{rotuloTipo(u.tipo)}</td>
              <td>{u.bairro ?? '—'}</td>
              <td>{regioes.find((r) => r.id === u.regiao_id)?.nome ?? '—'}</td>
              <td>{supervisores.find((s) => s.id === u.supervisor_id)?.nome ?? <span className="meta">não informado</span>}</td>
              <td>{u.ativo ? 'Ativa' : 'Inativa'}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </>
  );
}

function Regioes({ mid, regioes, aoMudar }: { mid: string; regioes: Opcao[]; aoMudar: () => void }) {
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  async function criar(ev: FormEvent) {
    ev.preventDefault(); setErro(null);
    if (!nome.trim()) return setErro('Informe o nome da região.');
    const { error } = await supabase.from('regioes').insert({ municipio_id: mid, nome: nome.trim(), slug: slugificar(nome) || 'regiao', ordem: regioes.length });
    if (error) return setErro(error.code === '23505' ? 'Já existe uma região com esse nome.' : mensagemErro(error));
    setNome(''); aoMudar();
  }
  async function renomear(r: Opcao, novo: string) {
    if (!novo.trim() || novo.trim() === r.nome) return;
    const { error } = await supabase.from('regioes').update({ nome: novo.trim() }).eq('id', r.id);
    if (error) setErro(mensagemErro(error)); else aoMudar();
  }
  async function excluir(r: Opcao) {
    if (!window.confirm(`Excluir a região "${r.nome}"? As unidades dela ficam sem região, e os vínculos de usuário com esta região são removidos.`)) return;
    const { error } = await supabase.from('regioes').delete().eq('id', r.id);
    if (error) setErro(mensagemErro(error)); else aoMudar();
  }
  return (
    <details className="secao-filha">
      <summary>Regiões ({regioes.length})</summary>
      <p className="meta">Agrupam unidades (ex.: por supervisão ou território). Um vínculo de usuário pode valer para uma região inteira.</p>
      <ul className="lista-filhos">
        {regioes.map((r) => (
          <li key={r.id} className="linha-campos">
            <label><span className="sr-only">Nome da região</span><input defaultValue={r.nome} onBlur={(e) => renomear(r, e.target.value)} /></label>
            <button type="button" className="botao-link perigo" onClick={() => excluir(r)}>Excluir<span className="sr-only"> {r.nome}</span></button>
          </li>
        ))}
      </ul>
      <form className="linha-campos" onSubmit={criar}>
        <label>Nova região<input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} /></label>
        <button className="botao-secundario">Adicionar região</button>
      </form>
      {erro && <p className="erro" role="alert">{erro}</p>}
    </details>
  );
}

interface Form {
  nome: string; sigla: string; slug: string; tipo: string; etapas: string[]; inep: string; conveniada: boolean;
  endereco: string; bairro: string; cep: string; telefone: string; email: string; site: string;
  regiaoId: string; supervisorId: string; foto: Midia | null; ordem: string; ativo: boolean; confirmar: boolean; legado: any;
}
const VAZIO: Form = {
  nome: '', sigla: '', slug: '', tipo: 'escola', etapas: [], inep: '', conveniada: false, endereco: '', bairro: '', cep: '', telefone: '',
  email: '', site: '', regiaoId: '', supervisorId: '', foto: null, ordem: '0', ativo: true, confirmar: false, legado: null,
};

export function EditarUnidade() {
  const { id } = useParams();
  const nova = !id;
  const navegar = useNavigate();
  const local = useLocation();
  const { atual } = useAuth();
  const mid = atual!.municipio.id;
  const { gerencia } = useAlcance();
  const [f, setF] = useState<Form>(VAZIO);
  const [carregando, setCarregando] = useState(!nova);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>((local.state as { aviso?: string } | null)?.aviso ?? null);
  const [salvando, setSalvando] = useState(false);
  const [slugManual, setSlugManual] = useState(!nova);
  const [regioes, setRegioes] = useState<Opcao[]>([]);
  const [supervisores, setSupervisores] = useState<Opcao[]>([]);
  const [sugestoes, setSugestoes] = useState<{ tipos: string[]; etapas: string[] }>({ tipos: [], etapas: [] });
  const mudar = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    Promise.all([
      supabase.from('regioes').select('id, nome').eq('municipio_id', mid).order('ordem').order('nome'),
      supabase.from('equipe').select('id, nome').eq('municipio_id', mid).eq('nivel', 2).order('ordem').order('nome'),
      supabase.from('unidades').select('tipo, etapas').eq('municipio_id', mid),
    ]).then(([r, s, u]) => {
      setRegioes(r.data ?? []); setSupervisores(s.data ?? []);
      const tipos = new Set(['escola', 'creche', ...(u.data ?? []).map((x) => x.tipo)]);
      const etapas = new Set([...Object.keys(ROTULO_ETAPA).filter((e) => !e.includes('_1') && !e.includes('_2')), ...(u.data ?? []).flatMap((x) => x.etapas ?? [])]);
      setSugestoes({ tipos: [...tipos].sort(), etapas: [...etapas] });
    });
    if (!id) return;
    supabase.from('unidades').select('*, foto:midias!unidades_foto_id_municipio_id_fkey(id, storage_path, nome_original, mime_type, texto_alternativo)')
      .eq('id', id).eq('municipio_id', mid).maybeSingle().then(({ data: d, error }) => {
        if (error || !d) { setErro(error ? mensagemErro(error) : 'Unidade não encontrada.'); setCarregando(false); return; }
        setF({
          nome: d.nome, sigla: d.sigla ?? '', slug: d.slug, tipo: d.tipo, etapas: d.etapas ?? [], inep: d.codigo_inep ?? '', conveniada: d.conveniada,
          endereco: d.endereco ?? '', bairro: d.bairro ?? '', cep: d.cep ?? '', telefone: d.telefone ?? '', email: d.email ?? '', site: d.site ?? '',
          regiaoId: d.regiao_id ?? '', supervisorId: d.supervisor_id ?? '', foto: d.foto ?? null, ordem: String(d.ordem ?? 0), ativo: d.ativo,
          confirmar: !!d.legado?.confirmar, legado: d.legado,
        });
        setCarregando(false);
      });
  }, [id, mid]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!slugManual) mudar('slug', slugificar(f.nome)); }, [f.nome, slugManual]);

  async function salvar(ev: FormEvent) {
    ev.preventDefault(); setErro(null); setAviso(null);
    if (!f.nome.trim()) return setErro('Informe o nome da unidade.');
    if (gerencia && !SLUG_VALIDO.test(f.slug)) return setErro('O endereço só pode ter letras minúsculas, números e hífens.');
    if (f.inep.trim() && !/^\d{8}$/.test(f.inep.trim())) return setErro('O código INEP tem 8 dígitos.');
    if (f.site.trim() && !/^https?:\/\//.test(f.site.trim())) return setErro('O site deve começar com https://.');
    if (f.foto && !f.foto.texto_alternativo?.trim()) return setErro('A foto precisa de texto alternativo.');
    // Campos de contato: quem só edita a própria unidade pode mudar. Os da rede só vão quando a pessoa gerencia.
    const contato = {
      nome: f.nome.trim(), sigla: f.sigla.trim() || null, etapas: f.etapas, endereco: f.endereco.trim() || null, bairro: f.bairro.trim() || null,
      cep: f.cep.trim() || null, telefone: f.telefone.trim() || null, email: f.email.trim() || null, site: f.site.trim() || null, foto_id: f.foto?.id ?? null,
    };
    const rede = gerencia ? {
      slug: f.slug, tipo: slugificar(f.tipo).replace(/-/g, '_') || 'escola', codigo_inep: f.inep.trim() || null, conveniada: f.conveniada,
      regiao_id: f.regiaoId || null, supervisor_id: f.supervisorId || null, ordem: Number(f.ordem) || 0, ativo: f.ativo,
      legado: f.confirmar ? { ...(f.legado ?? {}), confirmar: true } : (f.legado ? (({ confirmar: _c, ...resto }) => (Object.keys(resto).length ? resto : null))(f.legado) : null),
    } : {};
    setSalvando(true);
    const r = nova
      ? await supabase.from('unidades').insert({ ...contato, ...rede, municipio_id: mid }).select('id').single()
      : await supabase.from('unidades').update({ ...contato, ...rede }).eq('id', id).select('id').single();
    setSalvando(false);
    if (r.error) return setErro(r.error.code === '23505' ? 'Já existe uma unidade com esse endereço (slug).' : mensagemErro(r.error));
    setAviso('Unidade salva.');
    if (nova) navegar(`/unidades/${r.data.id}`, { replace: true, state: { aviso: 'Unidade salva.' } });
  }

  async function excluir() {
    if (!window.confirm('Excluir esta unidade? Os vínculos de usuário com ela são removidos. Para só tirar do site, desmarque "Ativa".')) return;
    const { error } = await supabase.from('unidades').delete().eq('id', id);
    if (error) setErro(mensagemErro(error)); else navegar('/unidades');
  }

  const etapasOpcoes = useMemo(() => [...new Set([...sugestoes.etapas, ...f.etapas])], [sugestoes.etapas, f.etapas]);
  if (carregando) return <p role="status">Carregando…</p>;
  const campo = (k: keyof Form, rotulo: string, tipo = 'text', ajuda?: string) => (
    <div className="campo"><label>{rotulo}<input type={tipo} value={f[k] as string} aria-describedby={ajuda ? `ajuda-${String(k)}` : undefined} onChange={(ev) => mudar(k, ev.target.value as never)} /></label>{ajuda && <small id={`ajuda-${String(k)}`}>{ajuda}</small>}</div>
  );
  return (
    <form onSubmit={salvar} className="formulario-conteudo" noValidate>
      <div className="cabecalho-tela"><div>
        <p className="migalha"><Link to="/unidades">Unidades</Link></p>
        <h1>{nova ? 'Nova unidade' : f.nome}</h1>
      </div></div>
      {!gerencia && <p className="aviso-bloqueio" role="note">Você pode atualizar os dados de contato, a foto e as etapas desta unidade. Região, supervisor, tipo, INEP e situação são definidos por quem gerencia a rede.</p>}
      <div aria-live="polite">{erro && <p className="erro" role="alert">{erro}</p>}{aviso && <p className="sucesso" role="status">{aviso}</p>}</div>
      <fieldset disabled={salvando} className="grade-formulario">
        <div className="coluna-principal">
          <label><Obrigatorio>Nome</Obrigatorio><input value={f.nome} onChange={(ev) => mudar('nome', ev.target.value)} maxLength={200} placeholder="Ex.: EMEF Professora Maria da Silva" /></label>
          <div className="linha-campos">
            {campo('sigla', 'Sigla')}
            {gerencia && <label>Endereço no site<input value={f.slug} onChange={(ev) => { setSlugManual(true); mudar('slug', slugificar(ev.target.value)); }} /></label>}
          </div>
          <fieldset><legend>Endereço e contato</legend>
            {campo('endereco', 'Endereço')}
            <div className="linha-campos">{campo('bairro', 'Bairro')}{campo('cep', 'CEP')}</div>
            <div className="linha-campos">{campo('telefone', 'Telefone', 'tel', 'Pode incluir mais de um número e WhatsApp.')}{campo('email', 'E-mail', 'email')}</div>
            {campo('site', 'Site', 'url')}
          </fieldset>
          <fieldset><legend>Etapas atendidas</legend>
            <div className="grade-opcoes">
              {etapasOpcoes.map((e) => (
                <label key={e} className="opcao"><input type="checkbox" checked={f.etapas.includes(e)}
                  onChange={(ev) => mudar('etapas', ev.target.checked ? [...f.etapas, e] : f.etapas.filter((x) => x !== e))} /> {rotuloEtapa(e)}</label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="coluna-lateral">
          {gerencia && (
            <>
              <label>Tipo<input list="tipos-unidade" value={f.tipo} onChange={(ev) => mudar('tipo', ev.target.value)} /></label>
              <datalist id="tipos-unidade">{sugestoes.tipos.map((t) => <option key={t} value={t}>{rotuloTipo(t)}</option>)}</datalist>
              <label>Região
                <select value={f.regiaoId} onChange={(ev) => mudar('regiaoId', ev.target.value)}>
                  <option value="">—</option>{regioes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
              </label>
              <div className="campo"><label>Supervisor responsável
                <select value={f.supervisorId} aria-describedby="ajuda-supervisor" onChange={(ev) => mudar('supervisorId', ev.target.value)}>
                  <option value="">— (não informado)</option>{supervisores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select></label>
                <small id="ajuda-supervisor">Lista os supervisores cadastrados em Equipe gestora.</small>
              </div>
              {campo('inep', 'Código INEP', 'text', '8 dígitos.')}
              <label className="opcao"><input type="checkbox" checked={f.conveniada} onChange={(ev) => mudar('conveniada', ev.target.checked)} /> Conveniada</label>
              <label>Ordem<input type="number" value={f.ordem} onChange={(ev) => mudar('ordem', ev.target.value)} /></label>
              <label className="opcao"><input type="checkbox" checked={f.ativo} onChange={(ev) => mudar('ativo', ev.target.checked)} /> Ativa (aparece no site)</label>
              <label className="opcao"><input type="checkbox" checked={f.confirmar} onChange={(ev) => mudar('confirmar', ev.target.checked)} /> Dados a confirmar com a Secretaria</label>
            </>
          )}
          <CampoImagem rotulo="Foto da unidade" municipioId={mid} midia={f.foto} aoMudar={(m) => mudar('foto', m)} />
        </div>
      </fieldset>
      <div className="barra-acoes">
        <button className="botao" disabled={salvando}>Salvar</button>
        {!nova && gerencia && <button type="button" className="botao-perigo" onClick={excluir}>Excluir</button>}
      </div>
    </form>
  );
}
