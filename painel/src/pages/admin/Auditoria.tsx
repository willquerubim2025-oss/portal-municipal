// Auditoria (RF16): quem criou, alterou ou excluiu o quê e quando, com o que mudou.
// Gravada por trigger no banco (0004/0007); aqui só leitura, para admin.
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { mensagemErro, supabase } from '../../lib/supabase';
import { dataHora } from '../../lib/texto';

const TABELAS: Record<string, string> = {
  publicacoes: 'Notícia', paginas: 'Página', documentos: 'Documento', servicos: 'Serviço', eventos: 'Evento',
  perguntas_frequentes: 'Pergunta frequente', destaques: 'Banner/alerta', categorias: 'Categoria', midias: 'Mídia',
  menus: 'Menu', menu_itens: 'Item de menu', orgaos: 'Órgão', sistemas_externos: 'Sistema externo',
  transparencia_secoes: 'Seção da transparência', transparencia_itens: 'Item da transparência',
  redirecionamentos: 'Redirecionamento', membros: 'Acesso de usuário', municipios: 'Identidade/dados', documento_relacoes: 'Relação entre documentos',
};
const ACAO: Record<string, string> = { INSERT: 'Criou', UPDATE: 'Alterou', DELETE: 'Excluiu' };
const IGNORAR = new Set(['atualizado_em', 'atualizado_por', 'criado_em', 'criado_por', 'id', 'municipio_id']);
const POR_PAGINA = 50;

interface Registro { id: number; tabela: string; registro_id: string; acao: string; user_id: string | null; em: string; antes: any; depois: any }

function descricao(r: Registro, nomes: Record<string, string>): string {
  const l = r.depois ?? r.antes ?? {};
  // Acesso de usuário: mostra de quem é o acesso e o papel.
  if (r.tabela === 'membros') return `${nomes[l.user_id] ?? 'usuário'} (${l.papel})`;
  return l.titulo ?? l.nome ?? l.pergunta ?? l.rotulo ?? l.origem ?? l.nome_original ?? r.registro_id;
}
function curto(v: unknown): string {
  if (v === null || v === undefined || v === '') return '(vazio)';
  if (v === true) return 'sim';
  if (v === false) return 'não';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  const limpo = s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return limpo.length > 120 ? `${limpo.slice(0, 117)}…` : limpo;
}
function mudancas(r: Registro): [string, string, string][] {
  if (r.acao !== 'UPDATE' || !r.antes || !r.depois) return [];
  return Object.keys(r.depois)
    .filter((k) => !IGNORAR.has(k) && JSON.stringify(r.antes[k]) !== JSON.stringify(r.depois[k]))
    .map((k) => [k.replace(/_/g, ' '), curto(r.antes[k]), curto(r.depois[k])]);
}

export function Auditoria() {
  const { atual } = useAuth();
  const mid = atual!.municipio.id;
  const [tabela, setTabela] = useState('');
  const [dias, setDias] = useState('30');
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState<Registro[] | null>(null);
  const [total, setTotal] = useState(0);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setLista(null);
    let q = supabase.from('auditoria').select('id, tabela, registro_id, acao, user_id, em, antes, depois', { count: 'exact' })
      .eq('municipio_id', mid).order('em', { ascending: false }).range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
    if (tabela) q = q.eq('tabela', tabela);
    if (dias) q = q.gte('em', new Date(Date.now() - Number(dias) * 86400000).toISOString());
    q.then(async ({ data, count, error }) => {
      if (!ativo) return;
      if (error) setErro(mensagemErro(error));
      const regs = (data ?? []) as Registro[];
      // Autores + pessoas cujo acesso foi alterado (tabela membros).
      const ids = [...new Set([...regs.map((r) => r.user_id), ...regs.filter((r) => r.tabela === 'membros').map((r) => (r.depois ?? r.antes)?.user_id)].filter(Boolean))] as string[];
      if (ids.length) {
        const { data: ps } = await supabase.from('perfis').select('user_id, nome').in('user_id', ids);
        if (ativo) setNomes((n) => ({ ...n, ...Object.fromEntries((ps ?? []).map((p) => [p.user_id, p.nome])) }));
      }
      if (ativo) { setLista(regs); setTotal(count ?? 0); }
    });
    return () => { ativo = false; };
  }, [mid, tabela, dias, pagina]);

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  // Sem usuário = rotina automática; usuário sem perfil visível = equipe SECKE.
  const quem = (r: Registro) => (r.user_id ? nomes[r.user_id] ?? 'Equipe SECKE' : 'Sistema (rotina automática)');

  return (
    <>
      <div className="cabecalho-tela"><h1>Auditoria</h1></div>
      <p className="meta">Registro automático de todas as alterações no portal desta prefeitura. Não pode ser editado nem apagado.</p>
      <div className="filtros">
        <label>O quê
          <select value={tabela} onChange={(e) => { setTabela(e.target.value); setPagina(1); }}>
            <option value="">Tudo</option>
            {Object.entries(TABELAS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </label>
        <label>Período
          <select value={dias} onChange={(e) => { setDias(e.target.value); setPagina(1); }}>
            <option value="1">Últimas 24 horas</option><option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option><option value="365">Último ano</option><option value="">Tudo</option>
          </select>
        </label>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!lista ? <p role="status">Carregando…</p> : lista.length === 0 ? <p>Nenhuma alteração no período.</p> : (
        <ol className="lista-auditoria">
          {lista.map((r) => {
            const m = mudancas(r);
            return (
              <li key={r.id}>
                <p><strong>{quem(r)}</strong> {ACAO[r.acao].toLowerCase()} {(TABELAS[r.tabela] ?? r.tabela).toLowerCase()} <em>“{curto(descricao(r, nomes))}”</em></p>
                <p className="meta"><time dateTime={r.em}>{dataHora(r.em)}</time></p>
                {m.length > 0 && (
                  <details>
                    <summary>O que mudou ({m.length} {m.length === 1 ? 'campo' : 'campos'})</summary>
                    <table className="tabela tabela-compacta">
                      <thead><tr><th scope="col">Campo</th><th scope="col">Antes</th><th scope="col">Depois</th></tr></thead>
                      <tbody>{m.map(([k, a, d]) => <tr key={k}><td>{k}</td><td>{a}</td><td>{d}</td></tr>)}</tbody>
                    </table>
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {paginas > 1 && (
        <nav className="paginacao" aria-label="Paginação">
          <button type="button" className="botao-secundario" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Mais recentes</button>
          <span>Página {pagina} de {paginas}</span>
          <button type="button" className="botao-secundario" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>Mais antigas</button>
        </nav>
      )}
    </>
  );
}
