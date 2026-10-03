// Estrutura organizacional (LAI art. 8º §1º I). Cadastro direto (sem rascunho), só admin.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { mensagemErro, supabase } from '../../lib/supabase';
import { slugificar, SLUG_VALIDO } from '../../lib/texto';
import type { Midia } from '../../lib/midias';
import { usePortal } from '../../lib/portal';
import { EditorTexto } from '../../components/EditorTexto';
import { CampoImagem } from '../../components/CampoImagem';
import { Obrigatorio } from '../../components/Edicao';

const TIPOS: Record<string, string> = {
  gabinete: 'Gabinete', secretaria: 'Secretaria', departamento: 'Departamento', divisao: 'Divisão', setor: 'Setor',
  autarquia: 'Autarquia', fundacao: 'Fundação', conselho: 'Conselho', outro: 'Outro',
};
interface Orgao { id: string; parent_id: string | null; tipo: string; nome: string; sigla: string | null; responsavel_nome: string | null; ativo: boolean; ordem: number }

export function ListaOrgaos() {
  const { atual } = useAuth();
  const [lista, setLista] = useState<Orgao[] | null>(null);
  useEffect(() => {
    supabase.from('orgaos').select('id, parent_id, tipo, nome, sigla, responsavel_nome, ativo, ordem')
      .eq('municipio_id', atual!.municipio.id).order('ordem').order('nome').then(({ data }) => setLista(data ?? []));
  }, [atual]);
  const filhos = (pai: string | null) => (lista ?? []).filter((o) => (o.parent_id ?? null) === pai);
  const Arvore = ({ pai, nivel }: { pai: string | null; nivel: number }) => {
    const itens = filhos(pai);
    if (!itens.length) return null;
    return (
      <ul className={nivel ? 'arvore-sub' : 'arvore'}>
        {itens.map((o) => (
          <li key={o.id}>
            <Link to={`/orgaos/${o.id}`}>{o.nome}{o.sigla && ` (${o.sigla})`}</Link>
            <span className="meta"> · {TIPOS[o.tipo]}{o.responsavel_nome && ` · ${o.responsavel_nome}`}{!o.ativo && ' · inativo'}</span>
            <Arvore pai={o.id} nivel={nivel + 1} />
          </li>
        ))}
      </ul>
    );
  };
  return (
    <>
      <div className="cabecalho-tela">
        <h1>Estrutura organizacional</h1>
        <Link className="botao" to="/orgaos/novo">Novo órgão</Link>
      </div>
      <p className="meta">Gabinete, secretarias, departamentos e conselhos, com responsáveis e contatos. É exigência da Lei de Acesso à Informação.</p>
      {!lista ? <p role="status">Carregando…</p> : lista.length === 0 ? <p>Nenhum órgão cadastrado.</p> : <Arvore pai={null} nivel={0} />}
    </>
  );
}

interface Form {
  parentId: string; tipo: string; nome: string; sigla: string; slug: string; competencias: string; responsavelNome: string;
  responsavelCargo: string; foto: Midia | null; curriculo: string; email: string; telefone: string; endereco: string; horario: string; ordem: string; ativo: boolean;
}
const VAZIO: Form = { parentId: '', tipo: 'secretaria', nome: '', sigla: '', slug: '', competencias: '', responsavelNome: '', responsavelCargo: '', foto: null, curriculo: '', email: '', telefone: '', endereco: '', horario: '', ordem: '0', ativo: true };

export function EditarOrgao() {
  const { id } = useParams();
  const novo = !id;
  const navegar = useNavigate();
  const portal = usePortal();
  const { atual } = useAuth();
  const mid = atual!.municipio.id;
  const [f, setF] = useState<Form>(VAZIO);
  const [outros, setOutros] = useState<{ id: string; nome: string; parent_id: string | null }[]>([]);
  const [carregando, setCarregando] = useState(!novo);
  const [erro, setErro] = useState<string | null>(null);
  const local = useLocation();
  const [aviso, setAviso] = useState<string | null>((local.state as { aviso?: string } | null)?.aviso ?? null);
  const [salvando, setSalvando] = useState(false);
  const [slugManual, setSlugManual] = useState(!novo);
  const mudar = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    supabase.from('orgaos').select('id, nome, parent_id').eq('municipio_id', mid).order('nome').then(({ data }) => setOutros(data ?? []));
    if (!id) return;
    supabase.from('orgaos').select('*, foto:midias!orgaos_responsavel_foto_id_municipio_id_fkey(id, storage_path, nome_original, mime_type, texto_alternativo)')
      .eq('id', id).eq('municipio_id', mid).maybeSingle().then(({ data: d, error }) => {
        if (error || !d) { setErro(error ? mensagemErro(error) : 'Órgão não encontrado.'); setCarregando(false); return; }
        setF({
          parentId: d.parent_id ?? '', tipo: d.tipo, nome: d.nome, sigla: d.sigla ?? '', slug: d.slug, competencias: d.competencias_html ?? '',
          responsavelNome: d.responsavel_nome ?? '', responsavelCargo: d.responsavel_cargo ?? '', foto: d.foto ?? null, curriculo: d.responsavel_curriculo_html ?? '',
          email: d.email ?? '', telefone: d.telefone ?? '', endereco: d.endereco ?? '', horario: d.horario_atendimento ?? '', ordem: String(d.ordem ?? 0), ativo: d.ativo,
        });
        setCarregando(false);
      });
  }, [id, mid]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!slugManual) mudar('slug', slugificar(f.nome)); }, [f.nome, slugManual]);

  // Não pode ser subordinado a si mesmo nem a um subordinado seu (evita ciclo).
  const descendentes = new Set<string>();
  const marcar = (pai: string) => outros.filter((o) => o.parent_id === pai).forEach((o) => { descendentes.add(o.id); marcar(o.id); });
  if (id) marcar(id);
  const superiores = outros.filter((o) => o.id !== id && !descendentes.has(o.id));

  async function salvar(ev: FormEvent) {
    ev.preventDefault(); setErro(null); setAviso(null);
    if (!f.nome.trim()) return setErro('Informe o nome do órgão.');
    if (!SLUG_VALIDO.test(f.slug)) return setErro('O endereço só pode ter letras minúsculas, números e hífens.');
    if (f.foto && !f.foto.texto_alternativo?.trim()) return setErro('A foto precisa de texto alternativo.');
    const linha = {
      municipio_id: mid, parent_id: f.parentId || null, tipo: f.tipo, nome: f.nome.trim(), sigla: f.sigla.trim() || null, slug: f.slug,
      competencias_html: f.competencias || null, responsavel_nome: f.responsavelNome.trim() || null, responsavel_cargo: f.responsavelCargo.trim() || null,
      responsavel_foto_id: f.foto?.id ?? null, responsavel_curriculo_html: f.curriculo || null, email: f.email.trim() || null,
      telefone: f.telefone.trim() || null, endereco: f.endereco.trim() || null, horario_atendimento: f.horario.trim() || null,
      ordem: Number(f.ordem) || 0, ativo: f.ativo,
    };
    setSalvando(true);
    const r = novo ? await supabase.from('orgaos').insert(linha).select('id').single() : await supabase.from('orgaos').update(linha).eq('id', id).select('id').single();
    setSalvando(false);
    if (r.error) return setErro(mensagemErro(r.error));
    setAviso('Órgão salvo.');
    if (novo) navegar(`/orgaos/${r.data.id}`, { replace: true, state: { aviso: 'Órgão salvo.' } });
  }

  async function excluir() {
    if (!window.confirm('Excluir este órgão? Notícias, documentos e serviços vinculados ficam sem órgão. Para só esconder do site, desmarque "Ativo".')) return;
    const { error } = await supabase.from('orgaos').delete().eq('id', id);
    if (error) setErro(mensagemErro(error)); else navegar('/orgaos');
  }

  if (carregando) return <p role="status">Carregando…</p>;
  const campo = (k: keyof Form, rotulo: string, tipo = 'text') => (
    <label>{rotulo}<input type={tipo} value={f[k] as string} onChange={(ev) => mudar(k, ev.target.value as never)} /></label>
  );
  return (
    <form onSubmit={salvar} className="formulario-conteudo" noValidate>
      <div className="cabecalho-tela"><div>
        <p className="migalha"><Link to="/orgaos">Estrutura organizacional</Link></p>
        <h1>{novo ? 'Novo órgão' : f.nome}</h1>
        {!novo && portal && f.ativo && <p className="meta"><a href={`${portal}/estrutura-organizacional/${f.slug}`} target="_blank" rel="noopener">Ver no site<span className="sr-only"> (abre em nova aba)</span></a></p>}
      </div></div>
      <div aria-live="polite">{erro && <p className="erro" role="alert">{erro}</p>}{aviso && <p className="sucesso" role="status">{aviso}</p>}</div>
      <fieldset disabled={salvando} className="grade-formulario">
        <div className="coluna-principal">
          <label><Obrigatorio>Nome</Obrigatorio><input value={f.nome} onChange={(ev) => mudar('nome', ev.target.value)} placeholder="Ex.: Secretaria Municipal de Saúde" /></label>
          <div className="linha-campos">
            {campo('sigla', 'Sigla')}
            <label>Endereço no site<input value={f.slug} onChange={(ev) => { setSlugManual(true); mudar('slug', slugificar(ev.target.value)); }} /></label>
          </div>
          <div className="campo"><span className="rotulo-campo">Competências</span>
            <EditorTexto rotulo="Competências" valor={f.competencias} aoMudar={(v) => mudar('competencias', v)} municipioId={mid} />
          </div>
          <fieldset><legend>Responsável</legend>
            <div className="linha-campos">{campo('responsavelNome', 'Nome do responsável')}{campo('responsavelCargo', 'Cargo do responsável')}</div>
            <div className="campo"><span className="rotulo-campo">Currículo (opcional)</span>
              <EditorTexto rotulo="Currículo do responsável" valor={f.curriculo} aoMudar={(v) => mudar('curriculo', v)} municipioId={mid} />
            </div>
          </fieldset>
        </div>
        <div className="coluna-lateral">
          <label>Tipo<select value={f.tipo} onChange={(ev) => mudar('tipo', ev.target.value)}>{Object.entries(TIPOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></label>
          <label>Subordinado a
            <select value={f.parentId} onChange={(ev) => mudar('parentId', ev.target.value)}>
              <option value="">— (primeiro nível)</option>
              {superiores.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </label>
          {campo('telefone', 'Telefone', 'tel')}
          {campo('email', 'E-mail', 'email')}
          {campo('endereco', 'Endereço')}
          {campo('horario', 'Horário de atendimento')}
          <CampoImagem rotulo="Foto do responsável" municipioId={mid} midia={f.foto} aoMudar={(m) => mudar('foto', m)} />
          <label>Ordem<input type="number" value={f.ordem} onChange={(ev) => mudar('ordem', ev.target.value)} /></label>
          <label className="opcao"><input type="checkbox" checked={f.ativo} onChange={(ev) => mudar('ativo', ev.target.checked)} /> Ativo (aparece no site)</label>
        </div>
      </fieldset>
      <div className="barra-acoes">
        <button className="botao" disabled={salvando}>Salvar</button>
        {!novo && <button type="button" className="botao-perigo" onClick={excluir}>Excluir</button>}
      </div>
    </form>
  );
}
