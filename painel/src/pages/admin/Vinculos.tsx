// Vínculos de usuários com papéis (D-38): uma pessoa pode ter vários papéis, e cada vínculo pode
// apontar a unidade ou a região em que os escopos "unidade" e "região" valem (ex.: diretor da sua escola).
// Regras no banco (RLS de usuario_papeis, 0018): ninguém altera o próprio vínculo; só quem tem
// permissoes.gerenciar dá o papel de Administrador; toda mudança vai para o histórico.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { mensagemErro, supabase } from '../../lib/supabase';
import { dataHora } from '../../lib/texto';
import { Obrigatorio } from '../../components/Edicao';

interface Vinculo { id: string; user_id: string; papel_id: string; unidade_id: string | null; regiao_id: string | null; ativo: boolean; criado_em: string }
interface Pessoa { user_id: string; nome: string; email: string }
interface Opcao { id: string; nome: string }

export function Vinculos() {
  const { atual, sessao, pode } = useAuth();
  const mid = atual!.municipio.id;
  const eu = sessao?.user.id;
  const podeVincular = pode('usuarios.vincular');
  const [vinculos, setVinculos] = useState<Vinculo[] | null>(null);
  const [pessoas, setPessoas] = useState<Map<string, Pessoa>>(new Map());
  const [papeis, setPapeis] = useState<(Opcao & { protegido: boolean; ativo: boolean })[]>([]);
  const [unidades, setUnidades] = useState<Opcao[]>([]);
  const [regioes, setRegioes] = useState<Opcao[]>([]);
  const [novo, setNovo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [v, m, p, u, r] = await Promise.all([
      supabase.from('usuario_papeis').select('id, user_id, papel_id, unidade_id, regiao_id, ativo, criado_em').eq('municipio_id', mid).order('criado_em'),
      supabase.from('membros').select('user_id').eq('municipio_id', mid).eq('ativo', true),
      supabase.from('papeis').select('id, nome, protegido, ativo').eq('municipio_id', mid).order('protegido', { ascending: false }).order('nome'),
      supabase.from('unidades').select('id, nome').eq('municipio_id', mid).order('nome'),
      supabase.from('regioes').select('id, nome').eq('municipio_id', mid).order('ordem').order('nome'),
    ]);
    if (v.error) setErro(mensagemErro(v.error));
    const ids = [...new Set([...(v.data ?? []).map((x) => x.user_id), ...(m.data ?? []).map((x) => x.user_id)])];
    const { data: ps } = ids.length ? await supabase.from('perfis').select('user_id, nome, email').in('user_id', ids) : { data: [] };
    const mapa = new Map<string, Pessoa>(ids.map((id) => [id, { user_id: id, nome: '', email: '' }]));
    for (const x of ps ?? []) mapa.set(x.user_id, x as Pessoa);
    setPessoas(mapa);
    setVinculos(v.data ?? []);
    setPapeis(p.data ?? []);
    setUnidades(u.data ?? []);
    setRegioes(r.data ?? []);
  }, [mid]);
  useEffect(() => { carregar(); }, [carregar]);

  const nomeDe = (id: string) => { const p = pessoas.get(id); return p?.nome || p?.email || 'Pessoa sem perfil visível'; };
  const papelDe = (id: string) => papeis.find((p) => p.id === id);
  const alvo = (v: Vinculo) => v.unidade_id ? `unidade: ${unidades.find((u) => u.id === v.unidade_id)?.nome ?? '—'}`
    : v.regiao_id ? `região: ${regioes.find((r) => r.id === v.regiao_id)?.nome ?? '—'}` : 'toda a rede';

  // Agrupa por pessoa, em ordem alfabética.
  const porPessoa = useMemo(() => {
    const g = new Map<string, Vinculo[]>();
    for (const v of vinculos ?? []) g.set(v.user_id, [...(g.get(v.user_id) ?? []), v]);
    return [...g.entries()].sort(([a], [b]) => nomeDe(a).localeCompare(nomeDe(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vinculos, pessoas]);

  async function alternar(v: Vinculo) {
    setErro(null); setAviso(null);
    const { error } = await supabase.from('usuario_papeis').update({ ativo: !v.ativo }).eq('id', v.id);
    if (error) setErro(mensagemErro(error)); else { setAviso(v.ativo ? 'Vínculo suspenso.' : 'Vínculo reativado.'); carregar(); }
  }
  async function remover(v: Vinculo) {
    setErro(null); setAviso(null);
    if (!window.confirm(`Retirar o papel "${papelDe(v.papel_id)?.nome}" de ${nomeDe(v.user_id)}? O histórico é mantido.`)) return;
    const { error } = await supabase.from('usuario_papeis').delete().eq('id', v.id);
    if (error) setErro(mensagemErro(error)); else { setAviso('Papel retirado.'); carregar(); }
  }

  return (
    <>
      <div className="cabecalho-tela">
        <h1>Vínculos de usuários</h1>
        {podeVincular && !novo && <button type="button" className="botao" onClick={() => setNovo(true)}>Dar papel a alguém</button>}
      </div>
      <p className="meta">Quem tem cada papel nesta organização. Uma pessoa pode ter mais de um papel (ex.: diretora que também é professora). Ninguém altera o próprio acesso.</p>
      <div aria-live="polite">{erro && <p className="erro" role="alert">{erro}</p>}{aviso && <p className="sucesso" role="status">{aviso}</p>}</div>
      {novo && (
        <NovoVinculo mid={mid} eu={eu} pessoas={[...pessoas.values()]} papeis={papeis.filter((p) => p.ativo)} unidades={unidades} regioes={regioes}
          aoFechar={(ok) => { setNovo(false); if (ok) { setAviso('Papel atribuído.'); carregar(); } }} />
      )}
      {!vinculos ? <p role="status">Carregando…</p> : porPessoa.length === 0 ? <p>Ninguém tem papel configurável nesta organização ainda.</p> : (
        <table className="tabela">
          <caption className="sr-only">Papéis de cada pessoa</caption>
          <thead><tr><th scope="col">Pessoa</th><th scope="col">Papel</th><th scope="col">Onde vale</th><th scope="col">Desde</th><th scope="col">Situação</th></tr></thead>
          <tbody>{porPessoa.flatMap(([uid, vs]) => vs.map((v, i) => {
            const proprio = uid === eu;
            return (
              <tr key={v.id} className={v.ativo ? undefined : 'inativo'}>
                {i === 0 && <th scope="rowgroup" rowSpan={vs.length}>{nomeDe(uid)}{proprio && <span className="meta"> (você)</span>}<br /><span className="meta">{pessoas.get(uid)?.email}</span></th>}
                <td>{papelDe(v.papel_id)?.nome ?? '—'}</td>
                <td>{alvo(v)}</td>
                <td>{dataHora(v.criado_em)}</td>
                <td>
                  {v.ativo ? 'Ativo' : 'Suspenso'}
                  {podeVincular && !proprio && (
                    <span className="acoes-linha acoes-celula">
                      <button type="button" className="botao-link" onClick={() => alternar(v)}>{v.ativo ? 'Suspender' : 'Reativar'}<span className="sr-only"> {papelDe(v.papel_id)?.nome} de {nomeDe(uid)}</span></button>
                      <button type="button" className="botao-link perigo" onClick={() => remover(v)}>Retirar<span className="sr-only"> {papelDe(v.papel_id)?.nome} de {nomeDe(uid)}</span></button>
                    </span>
                  )}
                </td>
              </tr>
            );
          }))}</tbody>
        </table>
      )}
      <p className="meta">Para dar acesso a alguém que ainda não tem conta, use "Dar papel a alguém" com o e-mail da pessoa: ela recebe um convite. A equipe da SECKE não aparece nesta lista.</p>
    </>
  );
}

function NovoVinculo({ mid, eu, pessoas, papeis, unidades, regioes, aoFechar }: {
  mid: string; eu?: string; pessoas: Pessoa[]; papeis: (Opcao & { protegido: boolean })[]; unidades: Opcao[]; regioes: Opcao[]; aoFechar: (ok: boolean) => void;
}) {
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [papelId, setPapelId] = useState(papeis[0]?.id ?? '');
  const [onde, setOnde] = useState<'rede' | 'unidade' | 'regiao'>('rede');
  const [unidadeId, setUnidadeId] = useState('');
  const [regiaoId, setRegiaoId] = useState('');
  const [nome, setNome] = useState('');
  const [semConta, setSemConta] = useState(false);
  const [convite, setConvite] = useState<{ enviado: boolean; link: string | null; existente: boolean } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const candidatos = pessoas.filter((p) => p.user_id !== eu).sort((a, b) => (a.nome || a.email).localeCompare(b.nome || b.email));

  async function salvar(ev: FormEvent) {
    ev.preventDefault(); setErro(null);
    if (!papelId) return setErro('Escolha o papel.');
    if (onde === 'unidade' && !unidadeId) return setErro('Escolha a unidade.');
    if (onde === 'regiao' && !regiaoId) return setErro('Escolha a região.');
    let alvoUser = userId;
    if (!alvoUser && email.trim()) {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErro('E-mail inválido.');
      // Pessoa que já tem conta visível (colega): procura pelo e-mail no perfil.
      const { data } = await supabase.from('perfis').select('user_id').ilike('email', email.trim()).maybeSingle();
      if (data) alvoUser = data.user_id;
      else {
        // Sem conta visível: convida (a função cria a conta, ou reaproveita a que já existe, e grava o vínculo).
        if (!semConta) { setSemConta(true); return setErro('Não encontramos essa pessoa entre os colegas. Informe o nome para enviar o convite.'); }
        if (!nome.trim()) return setErro('Informe o nome.');
        setSalvando(true);
        const { data: r, error } = await supabase.functions.invoke('convidar-usuario', {
          body: {
            municipio_id: mid, nome: nome.trim(), email: email.trim(), papel_id: papelId,
            unidade_id: onde === 'unidade' ? unidadeId : null, regiao_id: onde === 'regiao' ? regiaoId : null,
            redirect_to: `${location.origin}/redefinir-senha`,
          },
        });
        setSalvando(false);
        if (error) {
          const corpo = await (error as { context?: Response }).context?.json?.().catch(() => null);
          return setErro(corpo?.erro ?? 'Não foi possível convidar agora.');
        }
        return setConvite(r);
      }
    }
    if (!alvoUser) return setErro('Escolha a pessoa ou informe o e-mail.');
    if (alvoUser === eu) return setErro('Você não pode alterar o seu próprio acesso.');
    setSalvando(true);
    const { error } = await supabase.from('usuario_papeis').insert({
      municipio_id: mid, user_id: alvoUser, papel_id: papelId,
      unidade_id: onde === 'unidade' ? unidadeId : null, regiao_id: onde === 'regiao' ? regiaoId : null,
    });
    setSalvando(false);
    if (error) return setErro(error.code === '23505' ? 'Essa pessoa já tem esse papel nesse lugar.' : mensagemErro(error));
    aoFechar(true);
  }

  const papel = papeis.find((p) => p.id === papelId);
  if (convite) {
    return (
      <section className="painel-form" aria-labelledby="t-convite-ok">
        <h2 id="t-convite-ok">{convite.existente ? 'Acesso concedido' : 'Convite criado'}</h2>
        <p role="status">{nome} recebeu o papel {papel?.nome}.{convite.existente && ' A pessoa já tinha conta e entra com a senha de sempre.'}</p>
        {convite.enviado && <p>Enviamos um e-mail para <strong>{email}</strong> com o link para criar a senha.</p>}
        {convite.link && (
          <>
            <p>O e-mail automático não está disponível. <strong>Copie o link abaixo e envie para {nome}</strong>. Ele vale por tempo limitado e só pode ser usado uma vez.</p>
            <div className="linha-campos"><input readOnly value={convite.link} aria-label="Link de convite" onFocus={(e) => e.target.select()} /></div>
            <p className="acoes-linha">
              <button type="button" className="botao-secundario" onClick={async () => { await navigator.clipboard.writeText(convite.link!); setCopiado(true); }}>{copiado ? 'Link copiado' : 'Copiar link'}</button>
            </p>
          </>
        )}
        <p><button type="button" className="botao" onClick={() => aoFechar(true)}>Concluir</button></p>
      </section>
    );
  }
  return (
    <form className="painel-form" onSubmit={salvar} aria-labelledby="t-novo-vinculo">
      <h2 id="t-novo-vinculo">Dar papel a alguém</h2>
      <div className="linha-campos">
        <label><Obrigatorio>Pessoa</Obrigatorio>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} autoFocus>
            <option value="">—</option>
            {candidatos.map((p) => <option key={p.user_id} value={p.user_id}>{p.nome || p.email || p.user_id}{p.nome && p.email ? ` (${p.email})` : ''}</option>)}
          </select>
        </label>
        {!userId && <label>ou e-mail (quem ainda não tem conta recebe um convite)<input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setSemConta(false); }} /></label>}
        {!userId && semConta && <label><Obrigatorio>Nome completo</Obrigatorio><input value={nome} onChange={(e) => setNome(e.target.value)} /></label>}
        <label><Obrigatorio>Papel</Obrigatorio>
          <select value={papelId} onChange={(e) => setPapelId(e.target.value)}>
            {papeis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
      </div>
      <fieldset>
        <legend>Onde o papel vale</legend>
        <div className="linha-campos">
          <label className="opcao"><input type="radio" name="onde" checked={onde === 'rede'} onChange={() => setOnde('rede')} /> Toda a rede</label>
          <label className="opcao"><input type="radio" name="onde" checked={onde === 'unidade'} onChange={() => setOnde('unidade')} /> Uma unidade</label>
          <label className="opcao"><input type="radio" name="onde" checked={onde === 'regiao'} onChange={() => setOnde('regiao')} /> Uma região</label>
        </div>
        {onde === 'unidade' && (
          <label>Unidade<select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}><option value="">—</option>{unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></label>
        )}
        {onde === 'regiao' && (
          <label>Região<select value={regiaoId} onChange={(e) => setRegiaoId(e.target.value)}><option value="">—</option>{regioes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select></label>
        )}
        <p className="meta">Permissões com alcance "só a unidade" ou "só a região" passam a valer para o lugar escolhido aqui. As de alcance "toda a rede" valem em todo lugar.</p>
      </fieldset>
      {papel?.protegido && <p className="meta">Atenção: o Administrador configura papéis e dá acesso a outras pessoas.</p>}
      {erro && <p className="erro" role="alert">{erro}</p>}
      <p className="acoes-linha">
        <button className="botao" disabled={salvando}>{salvando ? 'Salvando…' : semConta && !userId ? 'Convidar e atribuir papel' : 'Atribuir papel'}</button>
        <button type="button" className="botao-secundario" onClick={() => aoFechar(false)}>Cancelar</button>
      </p>
    </form>
  );
}
