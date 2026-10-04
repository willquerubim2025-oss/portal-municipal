// Acompanhamento do PNTP (RF11, D-35): para cada critério da matriz oficial do ciclo,
// onde o município atende (link com evidência), a situação e observações.
// Apoio à organização: não substitui a avaliação do Tribunal de Contas nem garante nota.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { mensagemErro, supabase } from '../../lib/supabase';
import { usePortal } from '../../lib/portal';
import { dataHora } from '../../lib/texto';

const CICLO = 2026;
// Matrizes que valem para uma prefeitura (Poder Executivo municipal).
const MATRIZES_PREFEITURA = ['COMUM', 'COMUM (EXCETO ESTATAIS)', 'COMUM (EXCETO ESTATAIS INDEPENDENTES)', 'EXECUTIVO', 'EXECUTIVO e CONSÓRCIOS'];

interface Criterio {
  id: string; codigo: string; dimensao: string; descricao: string; classificacao: 'essencial' | 'obrigatoria' | 'recomendada';
  aspectos: string[]; sugestao_caminho: string | null; sugestao_nota: string | null; ordem: number;
}
interface Atendimento { criterio_id: string; situacao: string; evidencia_url: string | null; observacao: string | null; verificado_em: string | null }

const SITUACOES: Record<string, string> = {
  nao_verificado: 'Não verificado', atende: 'Atende', parcial: 'Atende em parte', nao_atende: 'Não atende', nao_se_aplica: 'Não se aplica',
};
const CLASSE: Record<string, string> = { essencial: 'Essencial', obrigatoria: 'Obrigatório', recomendada: 'Recomendado' };
const ASPECTO: Record<string, string> = {
  atualidade: 'atualizado', serie_historica: 'série histórica', gravacao_relatorios: 'exportar relatórios', filtro_pesquisa: 'filtro de pesquisa',
};

export function Pntp() {
  const { atual, sessao } = useAuth();
  const mid = atual!.municipio.id;
  const portal = usePortal();
  const [criterios, setCriterios] = useState<Criterio[] | null>(null);
  const [atend, setAtend] = useState<Record<string, Atendimento>>({});
  const [filtro, setFiltro] = useState({ dimensao: '', situacao: '', classe: '' });
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [{ data: c, error: e1 }, { data: a, error: e2 }] = await Promise.all([
      supabase.from('pntp_criterios').select('id, codigo, dimensao, descricao, classificacao, aspectos, sugestao_caminho, sugestao_nota, ordem')
        .eq('ciclo', CICLO).in('matriz', MATRIZES_PREFEITURA).order('ordem'),
      supabase.from('pntp_atendimento').select('criterio_id, situacao, evidencia_url, observacao, verificado_em').eq('municipio_id', mid),
    ]);
    if (e1 || e2) setErro(mensagemErro(e1 ?? e2));
    setCriterios((c ?? []) as Criterio[]);
    setAtend(Object.fromEntries(((a ?? []) as Atendimento[]).map((x) => [x.criterio_id, x])));
  }, [mid]);
  useEffect(() => { carregar(); }, [carregar]);

  const situacao = (id: string) => atend[id]?.situacao ?? 'nao_verificado';
  const dimensoes = useMemo(() => [...new Set((criterios ?? []).map((c) => c.dimensao))], [criterios]);
  const resumo = useMemo(() => {
    const r = { atende: 0, parcial: 0, nao_atende: 0, nao_verificado: 0, nao_se_aplica: 0 };
    let ess = 0, essOk = 0;
    for (const c of criterios ?? []) {
      const s = situacao(c.id) as keyof typeof r;
      if (s in r) r[s]++;
      if (c.classificacao === 'essencial') { ess++; if (situacao(c.id) === 'atende') essOk++; }
    }
    return { ...r, ess, essOk, total: criterios?.length ?? 0 };
  }, [criterios, atend]);

  const visiveis = (criterios ?? []).filter((c) =>
    (!filtro.dimensao || c.dimensao === filtro.dimensao) && (!filtro.situacao || situacao(c.id) === filtro.situacao) && (!filtro.classe || c.classificacao === filtro.classe));

  async function salvar(c: Criterio, dados: Partial<Atendimento>) {
    setErro(null); setAviso(null);
    const linha = {
      municipio_id: mid, criterio_id: c.id,
      situacao: dados.situacao ?? situacao(c.id),
      evidencia_url: dados.evidencia_url !== undefined ? dados.evidencia_url : atend[c.id]?.evidencia_url ?? null,
      observacao: dados.observacao !== undefined ? dados.observacao : atend[c.id]?.observacao ?? null,
      verificado_em: new Date().toISOString(), verificado_por: sessao?.user.id ?? null,
    };
    const { error } = await supabase.from('pntp_atendimento').upsert(linha, { onConflict: 'municipio_id,criterio_id' });
    if (error) { setErro(mensagemErro(error)); return false; }
    setAtend((a) => ({ ...a, [c.id]: { ...linha } }));
    return true;
  }

  /** Preenche o link de evidência sugerido onde ainda não há link. Não marca "atende": isso é com quem confere. */
  async function preencherSugestoes() {
    if (!portal) return;
    const alvo = (criterios ?? []).filter((c) => c.sugestao_caminho && !atend[c.id]?.evidencia_url);
    if (!alvo.length) { setAviso('Todos os critérios com sugestão já têm link de evidência.'); return; }
    const linhas = alvo.map((c) => ({
      municipio_id: mid, criterio_id: c.id, situacao: situacao(c.id), evidencia_url: portal + c.sugestao_caminho,
      observacao: atend[c.id]?.observacao ?? null,
    }));
    const { error } = await supabase.from('pntp_atendimento').upsert(linhas, { onConflict: 'municipio_id,criterio_id' });
    if (error) { setErro(mensagemErro(error)); return; }
    setAviso(`${alvo.length} links de evidência preenchidos. Abra cada um, confira e marque a situação.`);
    await carregar();
  }

  return (
    <>
      <div className="cabecalho-tela">
        <h1>PNTP {CICLO}</h1>
        <button type="button" className="botao-secundario" onClick={preencherSugestoes} disabled={!portal || !criterios}>Preencher links sugeridos</button>
      </div>
      <p className="meta">
        Critérios do Programa Nacional de Transparência Pública (matriz oficial da Atricon, ciclo {CICLO}) que valem para a prefeitura.
        Para cada um, registre onde está a informação (link com evidência, exigido pelo tribunal para cada "sim") e a situação.
        Este acompanhamento ajuda a organizar a transparência; <strong>não substitui a avaliação do Tribunal de Contas nem garante nota</strong>.
      </p>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {aviso && <p className="sucesso" role="status">{aviso}</p>}

      {!criterios ? <p role="status">Carregando…</p> : criterios.length === 0 ? <p>A matriz do PNTP {CICLO} ainda não foi carregada.</p> : (
        <>
          <section aria-labelledby="t-resumo" className="secao-filha">
            <h2 id="t-resumo">Resumo</h2>
            <ul className="resumo-pntp">
              <li><strong>{resumo.atende}</strong> atendem</li>
              <li><strong>{resumo.parcial}</strong> em parte</li>
              <li><strong>{resumo.nao_atende}</strong> não atendem</li>
              <li><strong>{resumo.nao_verificado}</strong> não verificados</li>
              <li><strong>{resumo.nao_se_aplica}</strong> não se aplicam</li>
              <li><strong>{resumo.essOk} de {resumo.ess}</strong> essenciais atendidos</li>
            </ul>
            <p className="meta">{resumo.total} critérios no total. Os essenciais pesam mais na avaliação: deixá-los todos atendidos é a prioridade.</p>
          </section>

          <div className="filtros">
            <label>Dimensão
              <select value={filtro.dimensao} onChange={(e) => setFiltro({ ...filtro, dimensao: e.target.value })}>
                <option value="">Todas</option>
                {dimensoes.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label>Situação
              <select value={filtro.situacao} onChange={(e) => setFiltro({ ...filtro, situacao: e.target.value })}>
                <option value="">Todas</option>
                {Object.entries(SITUACOES).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </label>
            <label>Classificação
              <select value={filtro.classe} onChange={(e) => setFiltro({ ...filtro, classe: e.target.value })}>
                <option value="">Todas</option>
                {Object.entries(CLASSE).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </label>
          </div>

          <p className="meta" role="status">{visiveis.length} critério(s)</p>
          <ul className="lista-pntp">
            {visiveis.map((c, i) => {
              const a = atend[c.id];
              const novaDimensao = i === 0 || visiveis[i - 1].dimensao !== c.dimensao;
              return (
                <li key={c.id}>
                  {novaDimensao && <h2 className="dimensao-pntp">{c.dimensao}</h2>}
                  <Linha c={c} a={a} situacao={situacao(c.id)} aberto={aberto === c.id} portal={portal}
                    alternar={() => setAberto(aberto === c.id ? null : c.id)} salvar={(d) => salvar(c, d)} />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}

function Linha({ c, a, situacao, aberto, portal, alternar, salvar }: {
  c: Criterio; a: Atendimento | undefined; situacao: string; aberto: boolean; portal: string | null;
  alternar: () => void; salvar: (d: Partial<Atendimento>) => Promise<boolean>;
}) {
  const [url, setUrl] = useState(a?.evidencia_url ?? '');
  const [obs, setObs] = useState(a?.observacao ?? '');
  const [salvo, setSalvo] = useState(false);
  useEffect(() => { setUrl(a?.evidencia_url ?? ''); setObs(a?.observacao ?? ''); }, [a?.evidencia_url, a?.observacao]);
  const idSit = `sit-${c.id}`;

  return (
    <div className={`criterio-pntp situacao-${situacao}`}>
      <div className="criterio-pntp-topo">
        <p>
          <strong>{c.codigo}</strong> {c.descricao}
          <span className={`etiqueta etiqueta-${c.classificacao}`}>{CLASSE[c.classificacao]}</span>
        </p>
        <label htmlFor={idSit} className="sr-only">Situação do critério {c.codigo}</label>
        <select id={idSit} value={situacao} onChange={(e) => salvar({ situacao: e.target.value })}>
          {Object.entries(SITUACOES).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </div>
      {c.aspectos.length > 0 && (
        <p className="meta">O tribunal também avalia: {c.aspectos.filter((x) => ASPECTO[x]).map((x) => ASPECTO[x]).join(', ') || 'disponibilidade'}.</p>
      )}
      {a?.evidencia_url && !aberto && (
        <p className="meta">Evidência: <a href={a.evidencia_url} target="_blank" rel="noopener noreferrer">{a.evidencia_url}<span className="sr-only"> (abre em nova aba)</span></a></p>
      )}
      <button type="button" className="botao-link" aria-expanded={aberto} onClick={alternar}>
        {aberto ? 'Fechar' : a?.evidencia_url || a?.observacao ? 'Editar evidência e observação' : 'Registrar evidência'}
      </button>
      {aberto && (
        <form className="criterio-pntp-form" onSubmit={async (e) => {
          e.preventDefault();
          setSalvo(await salvar({ evidencia_url: url.trim() || null, observacao: obs.trim() || null }));
        }}>
          {c.sugestao_nota && (
            <p className="meta">
              Sugestão: {c.sugestao_nota}{' '}
              {portal && c.sugestao_caminho && <button type="button" className="botao-link" onClick={() => setUrl(portal + c.sugestao_caminho)}>Usar o link sugerido</button>}
            </p>
          )}
          <label>Link com a evidência
            <input type="url" value={url} onChange={(e) => { setUrl(e.target.value); setSalvo(false); }} placeholder="https://" />
          </label>
          <label>Observação
            <textarea rows={2} value={obs} onChange={(e) => { setObs(e.target.value); setSalvo(false); }} />
          </label>
          <div className="acoes">
            <button type="submit">Salvar</button>
            {salvo && <span role="status" className="sucesso">Salvo.</span>}
            {a?.verificado_em && <span className="meta">Última verificação: {dataHora(a.verificado_em)}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
