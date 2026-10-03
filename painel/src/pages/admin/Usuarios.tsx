// Usuários da prefeitura: convite (Edge Function convidar-usuario), papel e acesso (D-21).
// O admin não altera o próprio acesso (policy "membros: admin gerencia").
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { mensagemErro, supabase } from '../../lib/supabase';
import { ROTULO_PAPEL, type Papel } from '../../lib/tipos';
import { dataHora } from '../../lib/texto';
import { Obrigatorio } from '../../components/Edicao';

interface Membro { user_id: string; papel: Papel; ativo: boolean; criado_em: string; perfil: { nome: string; email: string; cargo: string | null } | null }
const DESCRICAO_PAPEL: Record<Papel, string> = {
  editor: 'cria e edita rascunhos; não publica',
  publicador: 'publica, agenda, retira do site e exclui conteúdo',
  admin: 'tudo do publicador + usuários, menus, transparência e identidade',
};

export function Usuarios() {
  const { atual, sessao } = useAuth();
  const mid = atual!.municipio.id;
  const eu = sessao?.user.id;
  const [lista, setLista] = useState<Membro[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [convidando, setConvidando] = useState(false);

  const carregar = useCallback(async () => {
    // membros e perfis não têm FK entre si (os dois apontam para auth.users): duas consultas.
    const { data, error } = await supabase.from('membros').select('user_id, papel, ativo, criado_em').eq('municipio_id', mid);
    if (error) setErro(mensagemErro(error));
    const ids = (data ?? []).map((m) => m.user_id);
    const { data: ps } = ids.length ? await supabase.from('perfis').select('user_id, nome, email, cargo').in('user_id', ids) : { data: [] };
    const perfil = new Map((ps ?? []).map((p) => [p.user_id, p]));
    setLista((data ?? []).map((m) => ({ ...m, perfil: perfil.get(m.user_id) ?? null }) as Membro).sort((a, b) => Number(b.ativo) - Number(a.ativo) || (a.perfil?.nome ?? '').localeCompare(b.perfil?.nome ?? '')));
  }, [mid]);
  useEffect(() => { carregar(); }, [carregar]);

  async function mudarPapel(m: Membro, papel: Papel) {
    setErro(null); setAviso(null);
    const { error } = await supabase.from('membros').update({ papel }).eq('municipio_id', mid).eq('user_id', m.user_id);
    if (error) setErro(mensagemErro(error)); else { setAviso(`${m.perfil?.nome} agora é ${ROTULO_PAPEL[papel].toLowerCase()}.`); carregar(); }
  }
  async function alternarAcesso(m: Membro) {
    setErro(null); setAviso(null);
    if (m.ativo && !window.confirm(`Desativar o acesso de ${m.perfil?.nome}? A pessoa não consegue mais entrar no painel desta prefeitura. O histórico (auditoria) é mantido.`)) return;
    const { error } = await supabase.from('membros').update({ ativo: !m.ativo }).eq('municipio_id', mid).eq('user_id', m.user_id);
    if (error) setErro(mensagemErro(error)); else { setAviso(m.ativo ? 'Acesso desativado.' : 'Acesso reativado.'); carregar(); }
  }

  return (
    <>
      <div className="cabecalho-tela">
        <h1>Usuários</h1>
        {!convidando && <button type="button" className="botao" onClick={() => setConvidando(true)}>Convidar usuário</button>}
      </div>
      <ul className="meta lista-papeis">
        {(Object.keys(DESCRICAO_PAPEL) as Papel[]).map((p) => <li key={p}><strong>{ROTULO_PAPEL[p]}</strong>: {DESCRICAO_PAPEL[p]}.</li>)}
      </ul>
      <div aria-live="polite">{erro && <p className="erro" role="alert">{erro}</p>}{aviso && <p className="sucesso" role="status">{aviso}</p>}</div>
      {convidando && <Convite mid={mid} aoFechar={(ok) => { setConvidando(false); if (ok) carregar(); }} />}
      {!lista ? <p role="status">Carregando…</p> : (
        <table className="tabela">
          <caption className="sr-only">Usuários da prefeitura</caption>
          <thead><tr><th scope="col">Nome</th><th scope="col">E-mail</th><th scope="col">Papel</th><th scope="col">Desde</th><th scope="col">Acesso</th></tr></thead>
          <tbody>{lista.map((m) => {
            const proprio = m.user_id === eu;
            return (
              <tr key={m.user_id} className={m.ativo ? undefined : 'inativo'}>
                <td>{m.perfil?.nome}{proprio && <span className="meta"> (você)</span>}</td>
                <td>{m.perfil?.email}</td>
                <td>
                  {proprio ? ROTULO_PAPEL[m.papel] : (
                    <select aria-label={`Papel de ${m.perfil?.nome}`} value={m.papel} onChange={(e) => mudarPapel(m, e.target.value as Papel)}>
                      {(Object.keys(ROTULO_PAPEL) as Papel[]).map((p) => <option key={p} value={p}>{ROTULO_PAPEL[p]}</option>)}
                    </select>
                  )}
                </td>
                <td>{dataHora(m.criado_em)}</td>
                <td>
                  {m.ativo ? 'Ativo' : 'Desativado'}{' '}
                  {!proprio && <button type="button" className="botao-link" onClick={() => alternarAcesso(m)}>{m.ativo ? 'Desativar' : 'Reativar'}<span className="sr-only"> {m.perfil?.nome}</span></button>}
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      )}
      <p className="meta">A equipe da SECKE tem acesso a todas as prefeituras para suporte e não aparece nesta lista.</p>
    </>
  );
}

function Convite({ mid, aoFechar }: { mid: string; aoFechar: (ok: boolean) => void }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState<Papel>('editor');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ enviado: boolean; link: string | null; existente: boolean } | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function enviar(ev: FormEvent) {
    ev.preventDefault(); setErro(null);
    if (!nome.trim()) return setErro('Informe o nome.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErro('E-mail inválido.');
    setEnviando(true);
    const { data, error } = await supabase.functions.invoke('convidar-usuario', {
      body: { municipio_id: mid, nome: nome.trim(), email: email.trim(), papel, redirect_to: `${location.origin}/redefinir-senha` },
    });
    setEnviando(false);
    if (error) {
      // FunctionsHttpError traz a resposta com a mensagem da função.
      const corpo = await (error as { context?: Response }).context?.json?.().catch(() => null);
      return setErro(corpo?.erro ?? 'Não foi possível convidar agora.');
    }
    setResultado(data);
  }

  if (resultado) {
    return (
      <section className="painel-form" aria-labelledby="t-convite-ok">
        <h2 id="t-convite-ok">{resultado.existente ? 'Acesso concedido' : 'Convite criado'}</h2>
        {resultado.existente && <p role="status">{nome} já tinha conta (atende outra prefeitura) e agora também acessa esta, como {ROTULO_PAPEL[papel].toLowerCase()}.</p>}
        {resultado.enviado && <p role="status">Enviamos um e-mail para <strong>{email}</strong> com o link para criar a senha.</p>}
        {resultado.link && (
          <>
            <p role="status">O e-mail automático não está disponível. <strong>Copie o link abaixo e envie para {nome}</strong> (ex.: por WhatsApp ou e-mail institucional). Ele vale por tempo limitado e só pode ser usado uma vez.</p>
            <div className="linha-campos">
              <input readOnly value={resultado.link} aria-label="Link de convite" onFocus={(e) => e.target.select()} />
            </div>
            <p className="acoes-linha">
              <button type="button" className="botao-secundario" onClick={async () => { await navigator.clipboard.writeText(resultado.link!); setCopiado(true); }}>{copiado ? 'Link copiado' : 'Copiar link'}</button>
            </p>
          </>
        )}
        <p><button type="button" className="botao" onClick={() => aoFechar(true)}>Concluir</button></p>
      </section>
    );
  }
  return (
    <form className="painel-form" onSubmit={enviar} aria-labelledby="t-convite">
      <h2 id="t-convite">Convidar usuário</h2>
      <div className="linha-campos">
        <label><Obrigatorio>Nome completo</Obrigatorio><input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></label>
        <label><Obrigatorio>E-mail</Obrigatorio><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Papel
          <select value={papel} onChange={(e) => setPapel(e.target.value as Papel)}>
            {(Object.keys(ROTULO_PAPEL) as Papel[]).map((p) => <option key={p} value={p}>{ROTULO_PAPEL[p]}</option>)}
          </select>
        </label>
      </div>
      <p className="meta">{ROTULO_PAPEL[papel]}: {DESCRICAO_PAPEL[papel]}.</p>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <p className="acoes-linha">
        <button className="botao" disabled={enviando}>{enviando ? 'Convidando…' : 'Convidar'}</button>
        <button type="button" className="botao-secundario" onClick={() => aoFechar(false)}>Cancelar</button>
      </p>
    </form>
  );
}
