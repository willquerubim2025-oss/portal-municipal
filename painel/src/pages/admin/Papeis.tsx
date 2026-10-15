// Papéis e permissões (D-38): cada organização cria os seus papéis e liga/desliga cada permissão,
// com escopo (rede, região, unidade ou próprio). O catálogo vem do código (lib/permissoes) e é
// sincronizado no banco; as regras valem no banco (RLS + gatilhos de 0018):
//  - o Administrador (papel protegido) não é excluído nem perde permissoes.gerenciar e usuarios.vincular;
//  - toda mudança fica no histórico (log_permissoes).
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { mensagemErro, supabase } from '../../lib/supabase';
import { dataHora, slugificar } from '../../lib/texto';
import { ESSENCIAIS_ADMIN, ROTULO_ESCOPO, type Escopo } from '../../lib/permissoes';
import { Obrigatorio } from '../../components/Edicao';

interface PapelLinha { id: string; slug: string; nome: string; descricao: string | null; sistema: boolean; protegido: boolean; ativo: boolean }
interface PermissaoBanco { codigo: string; modulo: string; nome: string; descricao: string | null; escopos: Escopo[]; ordem: number }
interface Ligacao { ativo: boolean; escopo: Escopo }
interface Registro { id: number; em: string; user_id: string | null; tabela: string; acao: string; papel_id: string | null; permissao_codigo: string | null; alvo_user_id: string | null; de: any; para: any }

export function Papeis() {
  const { atual } = useAuth();
  const mid = atual!.municipio.id;
  const [papeis, setPapeis] = useState<PapelLinha[] | null>(null);
  const [catalogo, setCatalogo] = useState<PermissaoBanco[]>([]);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [aba, setAba] = useState<'permissoes' | 'historico'>('permissoes');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [p, c] = await Promise.all([
      supabase.from('papeis').select('id, slug, nome, descricao, sistema, protegido, ativo').eq('municipio_id', mid)
        .order('protegido', { ascending: false }).order('sistema', { ascending: false }).order('nome'),
      supabase.from('permissoes').select('codigo, modulo, nome, descricao, escopos, ordem').eq('ativa', true).order('ordem'),
    ]);
    if (p.error) setErro(mensagemErro(p.error));
    setPapeis(p.data ?? []);
    setCatalogo((c.data ?? []) as PermissaoBanco[]);
    setSelecionado((s) => s ?? p.data?.[0]?.id ?? null);
  }, [mid]);
  useEffect(() => { carregar(); }, [carregar]);

  const papel = papeis?.find((x) => x.id === selecionado) ?? null;
  const avisar = (msg: string) => { setErro(null); setAviso(msg); };
  const falhar = (e: unknown) => { setAviso(null); setErro(mensagemErro(e)); };

  return (
    <>
      <div className="cabecalho-tela">
        <h1>Papéis e permissões</h1>
        {!criando && <button type="button" className="botao" onClick={() => setCriando(true)}>Novo papel</button>}
      </div>
      <p className="meta">
        Escolha um papel e ligue ou desligue o que ele pode fazer. Uma permissão nova do sistema chega sempre desligada.
        O Administrador não pode perder as permissões de configurar papéis e de atribuir papéis, para a organização nunca ficar sem quem a administre.
      </p>
      <div aria-live="polite">{erro && <p className="erro" role="alert">{erro}</p>}{aviso && <p className="sucesso" role="status">{aviso}</p>}</div>
      {criando && <NovoPapel mid={mid} aoFechar={async (id) => { setCriando(false); if (id) { await carregar(); setSelecionado(id); avisar('Papel criado. Ligue as permissões dele abaixo.'); } }} />}
      {!papeis ? <p role="status">Carregando…</p> : papeis.length === 0 ? <p>Nenhum papel cadastrado nesta organização.</p> : (
        <div className="grade-papeis">
          <nav aria-label="Papéis da organização">
            <ul className="lista-selecao">
              {papeis.map((p) => (
                <li key={p.id}>
                  <button type="button" className={p.id === selecionado ? 'item-selecao ativo' : 'item-selecao'} aria-current={p.id === selecionado ? 'true' : undefined}
                    onClick={() => { setSelecionado(p.id); setAviso(null); setErro(null); }}>
                    <span>{p.nome}</span>
                    <span className="meta">{p.protegido ? 'protegido' : p.sistema ? 'do sistema' : 'criado aqui'}{!p.ativo && ' · inativo'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          {papel && (
            <section aria-labelledby="t-papel">
              <DadosPapel key={`dados-${papel.id}`} papel={papel} aoMudar={async (msg) => { await carregar(); avisar(msg); }} aoExcluir={async () => { setSelecionado(null); await carregar(); avisar('Papel excluído.'); }} aoErro={falhar} />
              <div className="abas" role="tablist">
                <button type="button" role="tab" className="aba" aria-selected={aba === 'permissoes'} onClick={() => setAba('permissoes')}>Permissões</button>
                <button type="button" role="tab" className="aba" aria-selected={aba === 'historico'} onClick={() => setAba('historico')}>Histórico</button>
              </div>
              {aba === 'permissoes'
                ? <MatrizPermissoes key={`matriz-${papel.id}`} mid={mid} papel={papel} catalogo={catalogo} aoAvisar={avisar} aoErro={falhar} />
                : <Historico key={`historico-${papel.id}`} mid={mid} papel={papel} catalogo={catalogo} />}
            </section>
          )}
        </div>
      )}
    </>
  );
}

function NovoPapel({ mid, aoFechar }: { mid: string; aoFechar: (id: string | null) => void }) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  async function criar(ev: FormEvent) {
    ev.preventDefault(); setErro(null);
    if (!nome.trim()) return setErro('Informe o nome do papel.');
    setSalvando(true);
    const { data, error } = await supabase.from('papeis')
      .insert({ municipio_id: mid, nome: nome.trim(), slug: slugificar(nome) || 'papel', descricao: descricao.trim() || null })
      .select('id').single();
    setSalvando(false);
    if (error) return setErro(error.code === '23505' ? 'Já existe um papel com esse nome.' : mensagemErro(error));
    aoFechar(data.id);
  }
  return (
    <form className="painel-form" onSubmit={criar} aria-labelledby="t-novo-papel">
      <h2 id="t-novo-papel">Novo papel</h2>
      <div className="linha-campos">
        <label><Obrigatorio>Nome</Obrigatorio><input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} placeholder="Ex.: Coordenador pedagógico" autoFocus /></label>
        <label>Descrição<input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={200} placeholder="Quem é e o que faz" /></label>
      </div>
      <p className="meta">O papel nasce sem nenhuma permissão. Depois de criar, ligue o que ele pode fazer.</p>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <p className="acoes-linha">
        <button className="botao" disabled={salvando}>{salvando ? 'Criando…' : 'Criar papel'}</button>
        <button type="button" className="botao-secundario" onClick={() => aoFechar(null)}>Cancelar</button>
      </p>
    </form>
  );
}

function DadosPapel({ papel, aoMudar, aoExcluir, aoErro }: {
  papel: PapelLinha; aoMudar: (msg: string) => void; aoExcluir: () => void; aoErro: (e: unknown) => void;
}) {
  const [nome, setNome] = useState(papel.nome);
  const [descricao, setDescricao] = useState(papel.descricao ?? '');
  const alterado = nome.trim() !== papel.nome || (descricao.trim() || null) !== papel.descricao;
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    if (!nome.trim()) return aoErro({ message: 'Informe o nome do papel.' });
    const { error } = await supabase.from('papeis').update({ nome: nome.trim(), descricao: descricao.trim() || null }).eq('id', papel.id);
    if (error) aoErro(error); else aoMudar('Papel atualizado.');
  }
  async function alternarAtivo() {
    if (papel.ativo && !window.confirm(`Desativar o papel "${papel.nome}"? Quem tem só este papel perde as permissões dele até ser reativado.`)) return;
    const { error } = await supabase.from('papeis').update({ ativo: !papel.ativo }).eq('id', papel.id);
    if (error) aoErro(error); else aoMudar(papel.ativo ? 'Papel desativado.' : 'Papel reativado.');
  }
  async function excluir() {
    if (!window.confirm(`Excluir o papel "${papel.nome}"? As pessoas vinculadas a ele perdem estas permissões. O histórico é mantido.`)) return;
    const { error } = await supabase.from('papeis').delete().eq('id', papel.id);
    if (error) aoErro(error); else aoExcluir();
  }
  return (
    <form className="painel-form" onSubmit={salvar} aria-labelledby="t-papel">
      <h2 id="t-papel">{papel.nome}{!papel.ativo && <span className="etiqueta etiqueta-despublicado"> inativo</span>}</h2>
      {papel.protegido && <p className="meta">Papel protegido: não pode ser excluído nem desativado, e mantém sempre as permissões essenciais.</p>}
      <div className="linha-campos">
        <label>Nome<input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} /></label>
        <label>Descrição<input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={200} /></label>
      </div>
      <p className="acoes-linha">
        <button className="botao-secundario" disabled={!alterado}>Salvar nome e descrição</button>
        {!papel.protegido && <button type="button" className="botao-link" onClick={alternarAtivo}>{papel.ativo ? 'Desativar papel' : 'Reativar papel'}</button>}
        {!papel.protegido && !papel.sistema && <button type="button" className="botao-link perigo" onClick={excluir}>Excluir papel</button>}
      </p>
    </form>
  );
}

function MatrizPermissoes({ mid, papel, catalogo, aoAvisar, aoErro }: {
  mid: string; papel: PapelLinha; catalogo: PermissaoBanco[]; aoAvisar: (m: string) => void; aoErro: (e: unknown) => void;
}) {
  const [ligacoes, setLigacoes] = useState<Record<string, Ligacao> | null>(null);
  const [gravando, setGravando] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('papel_permissoes').select('permissao_codigo, ativo, escopo').eq('papel_id', papel.id).then(({ data, error }) => {
      if (error) aoErro(error);
      setLigacoes(Object.fromEntries((data ?? []).map((l) => [l.permissao_codigo, { ativo: l.ativo, escopo: l.escopo as Escopo }])));
    });
    // aoErro muda a cada renderização da tela-mãe; recarregar só quando o papel muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [papel.id]);

  const modulos = useMemo(() => {
    const m = new Map<string, PermissaoBanco[]>();
    for (const p of catalogo) m.set(p.modulo, [...(m.get(p.modulo) ?? []), p]);
    return [...m.entries()];
  }, [catalogo]);

  async function gravar(p: PermissaoBanco, nova: Ligacao) {
    setGravando(p.codigo);
    const { error } = await supabase.from('papel_permissoes').upsert(
      { municipio_id: mid, papel_id: papel.id, permissao_codigo: p.codigo, ativo: nova.ativo, escopo: nova.escopo },
      { onConflict: 'papel_id,permissao_codigo' },
    );
    setGravando(null);
    if (error) return aoErro(error);
    setLigacoes((l) => ({ ...l, [p.codigo]: nova }));
    aoAvisar(`${p.nome}: ${nova.ativo ? `ligada (${ROTULO_ESCOPO[nova.escopo].toLowerCase()})` : 'desligada'} para ${papel.nome}.`);
  }

  if (!ligacoes) return <p role="status">Carregando…</p>;
  return (
    <div className="matriz-permissoes">
      {modulos.map(([modulo, itens]) => (
        <fieldset key={modulo} className="secao-filha">
          <legend>{modulo}</legend>
          <ul className="lista-permissoes">
            {itens.map((p) => {
              const l = ligacoes[p.codigo] ?? { ativo: false, escopo: p.escopos[0] };
              const travada = papel.protegido && ESSENCIAIS_ADMIN.includes(p.codigo);
              return (
                <li key={p.codigo} className="linha-permissao">
                  <label className="opcao">
                    <input type="checkbox" checked={l.ativo} disabled={travada || gravando === p.codigo}
                      onChange={(e) => gravar(p, { ...l, ativo: e.target.checked })} aria-describedby={`desc-${p.codigo}`} />
                    <span><strong>{p.nome}</strong></span>
                  </label>
                  <small id={`desc-${p.codigo}`} className="meta">{p.descricao}{travada && ' Essencial do Administrador: sempre ligada.'}</small>
                  {p.escopos.length > 1 && (
                    <label className="escopo">Alcance
                      <select value={l.escopo} disabled={travada || gravando === p.codigo} onChange={(e) => gravar(p, { ...l, escopo: e.target.value as Escopo })}>
                        {p.escopos.map((e) => <option key={e} value={e}>{ROTULO_ESCOPO[e]}</option>)}
                      </select>
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
      <p className="meta">"Região" e "unidade" valem para a região ou unidade indicada no vínculo da pessoa (tela Vínculos de usuários).</p>
    </div>
  );
}

function Historico({ mid, papel, catalogo }: { mid: string; papel: PapelLinha; catalogo: PermissaoBanco[] }) {
  const [linhas, setLinhas] = useState<Registro[] | null>(null);
  const [nomes, setNomes] = useState<Map<string, string>>(new Map());
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    supabase.from('log_permissoes').select('id, em, user_id, tabela, acao, papel_id, permissao_codigo, alvo_user_id, de, para')
      .eq('municipio_id', mid).eq('papel_id', papel.id).order('em', { ascending: false }).limit(100)
      .then(async ({ data, error }) => {
        if (error) setErro(mensagemErro(error));
        const ls = (data ?? []) as Registro[];
        const ids = [...new Set(ls.flatMap((l) => [l.user_id, l.alvo_user_id]).filter(Boolean))] as string[];
        if (ids.length) {
          const { data: ps } = await supabase.from('perfis').select('user_id, nome').in('user_id', ids);
          setNomes(new Map((ps ?? []).map((p) => [p.user_id, p.nome])));
        }
        setLinhas(ls);
      });
  }, [mid, papel.id]);
  const nomePermissao = (c: string | null) => (c && catalogo.find((p) => p.codigo === c)?.nome) || c || '';
  const quem = (id: string | null) => (id ? nomes.get(id) ?? 'Usuário' : 'Sistema');
  const descrever = (l: Registro) => {
    if (l.tabela === 'papel_permissoes') {
      const de = l.de ? `${l.de.ativo ? 'ligada' : 'desligada'} (${ROTULO_ESCOPO[l.de.escopo as Escopo]?.toLowerCase()})` : 'sem registro';
      const para = l.para ? `${l.para.ativo ? 'ligada' : 'desligada'} (${ROTULO_ESCOPO[l.para.escopo as Escopo]?.toLowerCase()})` : 'removida';
      return `${nomePermissao(l.permissao_codigo)}: ${de} → ${para}`;
    }
    if (l.tabela === 'usuario_papeis') return `${l.acao === 'DELETE' ? 'Vínculo removido' : l.acao === 'INSERT' ? 'Vínculo criado' : 'Vínculo alterado'}: ${quem(l.alvo_user_id)}`;
    return l.acao === 'INSERT' ? 'Papel criado' : l.acao === 'DELETE' ? 'Papel excluído' : 'Dados do papel alterados';
  };
  if (erro) return <p className="erro" role="alert">{erro}</p>;
  if (!linhas) return <p role="status">Carregando…</p>;
  if (!linhas.length) return <p>Nenhuma mudança registrada para este papel.</p>;
  return (
    <table className="tabela">
      <caption className="sr-only">Histórico do papel {papel.nome}</caption>
      <thead><tr><th scope="col">Quando</th><th scope="col">Quem</th><th scope="col">O que mudou</th></tr></thead>
      <tbody>{linhas.map((l) => <tr key={l.id}><td>{dataHora(l.em)}</td><td>{quem(l.user_id)}</td><td>{descrever(l)}</td></tr>)}</tbody>
    </table>
  );
}
