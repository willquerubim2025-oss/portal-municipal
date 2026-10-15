// Equipe gestora (0019, D-38): três níveis (1 direção · 2 supervisão · 3 divisões e departamentos).
// Regras no banco: foto só com autorização de uso de imagem (ECA/LGPD); o portal mostra só quem está
// visível; dados_confirmados = false marca o que ainda não foi confirmado (não inventar dados oficiais).
// A seção inteira some do portal com config.modulos.equipe_gestora = false (Identidade visual e dados).
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { mensagemErro, supabase } from '../../lib/supabase';
import type { Midia } from '../../lib/midias';
import { CampoImagem } from '../../components/CampoImagem';
import { Obrigatorio } from '../../components/Edicao';

const NIVEIS: Record<number, { titulo: string; ajuda: string }> = {
  1: { titulo: 'Direção', ajuda: 'Secretário(a) e adjunto(a): cards maiores, no topo.' },
  2: { titulo: 'Supervisão', ajuda: 'Supervisores: podem ser indicados como responsáveis pelas unidades.' },
  3: { titulo: 'Divisões e departamentos', ajuda: 'Diretores de divisão ou departamento, agrupados pela divisão do organograma.' },
};
interface Pessoa { id: string; nome: string; cargo: string; nivel: number; visivel: boolean; dados_confirmados: boolean; autorizacao_imagem: boolean; foto_id: string | null; ordem: number; orgao: { nome: string } | null }

export function ListaEquipe() {
  const { atual } = useAuth();
  const mid = atual!.municipio.id;
  const [lista, setLista] = useState<Pessoa[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('equipe')
      .select('id, nome, cargo, nivel, visivel, dados_confirmados, autorizacao_imagem, foto_id, ordem, orgao:orgaos(nome)')
      .eq('municipio_id', mid).order('nivel').order('ordem').order('nome');
    if (error) setErro(mensagemErro(error));
    setLista((data ?? []) as unknown as Pessoa[]);
  }, [mid]);
  useEffect(() => { carregar(); }, [carregar]);
  const pendentes = (lista ?? []).filter((p) => !p.dados_confirmados).length;
  return (
    <>
      <div className="cabecalho-tela">
        <h1>Equipe gestora</h1>
        <Link className="botao" to="/equipe/nova">Nova pessoa</Link>
      </div>
      <p className="meta">Aparece no portal, na seção Equipe gestora, só quem estiver marcado como visível. Foto só com autorização de uso de imagem.</p>
      {pendentes > 0 && <p className="aviso-bloqueio" role="note">{pendentes} pessoa(s) com dados ainda não confirmados com a Secretaria.</p>}
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!lista ? <p role="status">Carregando…</p> : lista.length === 0 ? <p>Ninguém cadastrado ainda.</p> : [1, 2, 3].map((n) => {
        const nivel = lista.filter((p) => p.nivel === n);
        if (!nivel.length) return null;
        return (
          <section key={n} aria-labelledby={`t-nivel-${n}`}>
            <h2 id={`t-nivel-${n}`}>{NIVEIS[n].titulo}</h2>
            <table className="tabela">
              <caption className="sr-only">{NIVEIS[n].titulo}</caption>
              <thead><tr><th scope="col">Nome</th><th scope="col">Cargo</th>{n === 3 && <th scope="col">Divisão</th>}<th scope="col">No portal</th><th scope="col">Dados</th></tr></thead>
              <tbody>{nivel.map((p) => (
                <tr key={p.id}>
                  <td><Link to={`/equipe/${p.id}`}>{p.nome}</Link></td>
                  <td>{p.cargo}</td>
                  {n === 3 && <td>{p.orgao?.nome ?? '—'}</td>}
                  <td>{p.visivel ? 'Visível' : 'Oculto'}{p.foto_id ? ' · com foto' : ''}</td>
                  <td>{p.dados_confirmados ? 'Confirmados' : <span className="etiqueta etiqueta-destaque">a confirmar</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </section>
        );
      })}
    </>
  );
}

interface Form {
  nome: string; cargo: string; nivel: string; orgaoId: string; autorizacao: boolean; foto: Midia | null; email: string; telefone: string;
  resumo: string; ordem: string; visivel: boolean; confirmados: boolean;
}
const VAZIO: Form = { nome: '', cargo: '', nivel: '2', orgaoId: '', autorizacao: false, foto: null, email: '', telefone: '', resumo: '', ordem: '0', visivel: false, confirmados: false };

export function EditarEquipe() {
  const { id } = useParams();
  const nova = !id;
  const navegar = useNavigate();
  const local = useLocation();
  const { atual } = useAuth();
  const mid = atual!.municipio.id;
  const [f, setF] = useState<Form>(VAZIO);
  const [orgaos, setOrgaos] = useState<{ id: string; nome: string }[]>([]);
  const [carregando, setCarregando] = useState(!nova);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>((local.state as { aviso?: string } | null)?.aviso ?? null);
  const [salvando, setSalvando] = useState(false);
  const mudar = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    supabase.from('orgaos').select('id, nome').eq('municipio_id', mid).eq('ativo', true).order('ordem').order('nome').then(({ data }) => setOrgaos(data ?? []));
    if (!id) return;
    supabase.from('equipe').select('*, foto:midias!equipe_foto_id_municipio_id_fkey(id, storage_path, nome_original, mime_type, texto_alternativo)')
      .eq('id', id).eq('municipio_id', mid).maybeSingle().then(({ data: d, error }) => {
        if (error || !d) { setErro(error ? mensagemErro(error) : 'Pessoa não encontrada.'); setCarregando(false); return; }
        setF({
          nome: d.nome, cargo: d.cargo, nivel: String(d.nivel), orgaoId: d.orgao_id ?? '', autorizacao: d.autorizacao_imagem, foto: d.foto ?? null,
          email: d.email ?? '', telefone: d.telefone ?? '', resumo: d.resumo ?? '', ordem: String(d.ordem ?? 0), visivel: d.visivel, confirmados: d.dados_confirmados,
        });
        setCarregando(false);
      });
  }, [id, mid]);

  async function salvar(ev: FormEvent) {
    ev.preventDefault(); setErro(null); setAviso(null);
    if (!f.nome.trim()) return setErro('Informe o nome.');
    if (!f.cargo.trim()) return setErro('Informe o cargo.');
    if (f.foto && !f.autorizacao) return setErro('Para manter a foto, marque a autorização de uso de imagem (ou remova a foto).');
    if (f.foto && !f.foto.texto_alternativo?.trim()) return setErro('A foto precisa de texto alternativo.');
    const linha = {
      nome: f.nome.trim(), cargo: f.cargo.trim(), nivel: Number(f.nivel), orgao_id: f.nivel === '3' ? f.orgaoId || null : null,
      autorizacao_imagem: f.autorizacao, foto_id: f.autorizacao ? f.foto?.id ?? null : null, email: f.email.trim() || null,
      telefone: f.telefone.trim() || null, resumo: f.resumo.trim() || null, ordem: Number(f.ordem) || 0, visivel: f.visivel, dados_confirmados: f.confirmados,
    };
    setSalvando(true);
    const r = nova ? await supabase.from('equipe').insert({ ...linha, municipio_id: mid }).select('id').single()
      : await supabase.from('equipe').update(linha).eq('id', id).select('id').single();
    setSalvando(false);
    if (r.error) return setErro(r.error.code === '23514' ? 'Foto só com autorização de uso de imagem.' : mensagemErro(r.error));
    setAviso('Dados salvos.');
    if (nova) navegar(`/equipe/${r.data.id}`, { replace: true, state: { aviso: 'Dados salvos.' } });
  }

  async function excluir() {
    if (!window.confirm('Excluir esta pessoa da equipe gestora? Se ela for supervisora de alguma unidade, a unidade fica sem supervisor. Para só esconder do portal, desmarque "Visível".')) return;
    const { error } = await supabase.from('equipe').delete().eq('id', id);
    if (error) setErro(mensagemErro(error)); else navegar('/equipe');
  }

  if (carregando) return <p role="status">Carregando…</p>;
  return (
    <form onSubmit={salvar} className="formulario-conteudo" noValidate>
      <div className="cabecalho-tela"><div>
        <p className="migalha"><Link to="/equipe">Equipe gestora</Link></p>
        <h1>{nova ? 'Nova pessoa' : f.nome}</h1>
      </div></div>
      <div aria-live="polite">{erro && <p className="erro" role="alert">{erro}</p>}{aviso && <p className="sucesso" role="status">{aviso}</p>}</div>
      <fieldset disabled={salvando} className="grade-formulario">
        <div className="coluna-principal">
          <div className="linha-campos">
            <label><Obrigatorio>Nome</Obrigatorio><input value={f.nome} onChange={(ev) => mudar('nome', ev.target.value)} maxLength={150} /></label>
            <label><Obrigatorio>Cargo</Obrigatorio><input value={f.cargo} onChange={(ev) => mudar('cargo', ev.target.value)} maxLength={150} placeholder="Ex.: Supervisora de Ensino" /></label>
          </div>
          <fieldset><legend>Nível na equipe</legend>
            {[1, 2, 3].map((n) => (
              <label key={n} className="opcao"><input type="radio" name="nivel" checked={f.nivel === String(n)} onChange={() => mudar('nivel', String(n))} />
                <span><strong>{NIVEIS[n].titulo}</strong> <span className="meta">— {NIVEIS[n].ajuda}</span></span></label>
            ))}
          </fieldset>
          {f.nivel === '3' && (
            <label>Divisão ou departamento (organograma)
              <select value={f.orgaoId} onChange={(ev) => mudar('orgaoId', ev.target.value)}>
                <option value="">—</option>{orgaos.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </label>
          )}
          <div className="linha-campos">
            <label>E-mail institucional<input type="email" value={f.email} onChange={(ev) => mudar('email', ev.target.value)} /></label>
            <label>Telefone<input type="tel" value={f.telefone} onChange={(ev) => mudar('telefone', ev.target.value)} /></label>
          </div>
          <label>Resumo (opcional)<textarea rows={3} value={f.resumo} maxLength={500} onChange={(ev) => mudar('resumo', ev.target.value)} /></label>
        </div>
        <div className="coluna-lateral">
          <label className="opcao"><input type="checkbox" checked={f.visivel} onChange={(ev) => mudar('visivel', ev.target.checked)} /> Visível no portal</label>
          <label className="opcao"><input type="checkbox" checked={f.confirmados} onChange={(ev) => mudar('confirmados', ev.target.checked)} /> Nome e cargo confirmados pela Secretaria</label>
          <fieldset>
            <legend>Foto</legend>
            <label className="opcao"><input type="checkbox" checked={f.autorizacao} onChange={(ev) => mudar('autorizacao', ev.target.checked)} /> A pessoa autorizou o uso da imagem</label>
            {f.autorizacao
              ? <CampoImagem rotulo="Foto" municipioId={mid} midia={f.foto} aoMudar={(m) => mudar('foto', m)} />
              : <p className="meta">Sem autorização, o portal mostra as iniciais sobre a cor do portal, no lugar da foto.</p>}
          </fieldset>
          <label>Ordem<input type="number" value={f.ordem} onChange={(ev) => mudar('ordem', ev.target.value)} /></label>
        </div>
      </fieldset>
      <div className="barra-acoes">
        <button className="botao" disabled={salvando}>Salvar</button>
        {!nova && <button type="button" className="botao-perigo" onClick={excluir}>Excluir</button>}
      </div>
    </form>
  );
}
