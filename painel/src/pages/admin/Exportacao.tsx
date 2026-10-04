// Exportação completa dos dados (RF19, D-32). O admin pede; a Edge Function exportar
// gera o ZIP em até alguns minutos; o download é por link assinado (bucket privado).
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { mensagemErro, supabase } from '../../lib/supabase';
import { dataHora } from '../../lib/texto';

interface Exportacao { id: string; status: string; arquivo_path: string | null; erro: string | null; criado_em: string; concluido_em: string | null }

const SITUACAO: Record<string, string> = {
  pendente: 'Na fila (começa em até 1 minuto)',
  processando: 'Gerando…',
  concluida: 'Pronta',
  erro: 'Falhou',
};

export function Exportacao() {
  const { atual } = useAuth();
  const mid = atual!.municipio.id;
  const [lista, setLista] = useState<Exportacao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pedindo, setPedindo] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('exportacoes').select('id, status, arquivo_path, erro, criado_em, concluido_em')
      .eq('municipio_id', mid).order('criado_em', { ascending: false }).limit(10);
    if (error) setErro(mensagemErro(error));
    setLista((data ?? []) as Exportacao[]);
  }, [mid]);
  useEffect(() => { carregar(); }, [carregar]);

  const emAndamento = !!lista?.some((e) => ['pendente', 'processando'].includes(e.status));
  useEffect(() => {
    if (!emAndamento) return;
    const t = setInterval(carregar, 10_000);
    return () => clearInterval(t);
  }, [emAndamento, carregar]);

  async function gerar() {
    setPedindo(true); setErro(null);
    const { error } = await supabase.from('exportacoes').insert({ municipio_id: mid });
    setPedindo(false);
    if (error) setErro(error.code === '23505' ? 'Já há uma exportação em andamento.' : mensagemErro(error));
    await carregar();
  }

  async function baixar(e: Exportacao) {
    setErro(null);
    const { data, error } = await supabase.storage.from('exportacoes').createSignedUrl(e.arquivo_path!, 300, { download: true });
    if (error || !data) { setErro(mensagemErro(error)); return; }
    window.location.href = data.signedUrl;
  }

  return (
    <>
      <div className="cabecalho-tela">
        <h1>Exportar dados</h1>
        <button type="button" onClick={gerar} disabled={pedindo || emAndamento}>
          {emAndamento ? 'Exportação em andamento' : pedindo ? 'Pedindo…' : 'Gerar exportação'}
        </button>
      </div>
      <p className="meta">
        Gera um arquivo ZIP com <strong>todos os dados do portal</strong> desta prefeitura em formato aberto (JSON e
        planilhas CSV): notícias, documentos, páginas, serviços, agenda, estrutura, transparência, redirecionamentos,
        usuários, chamados e auditoria. Inclui a lista de todos os arquivos (PDFs, imagens) com o endereço de cada um.
        Os arquivos em si não vão no ZIP por causa do tamanho; a cópia integral pode ser pedida à SECKE.
      </p>
      <p className="meta">Ficam guardadas as 3 exportações mais recentes.</p>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!lista ? <p role="status">Carregando…</p> : lista.length === 0 ? <p>Nenhuma exportação feita ainda.</p> : (
        <table className="tabela">
          <caption className="sr-only">Exportações pedidas</caption>
          <thead><tr><th scope="col">Pedida em</th><th scope="col">Situação</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
          <tbody>
            {lista.map((e) => (
              <tr key={e.id}>
                <td><time dateTime={e.criado_em}>{dataHora(e.criado_em)}</time></td>
                <td role={['pendente', 'processando'].includes(e.status) ? 'status' : undefined}>
                  {SITUACAO[e.status] ?? e.status}
                  {e.status === 'concluida' && e.concluido_em && <span className="meta"> em {dataHora(e.concluido_em)}</span>}
                  {e.status === 'erro' && e.erro && <span className="meta"> ({e.erro})</span>}
                </td>
                <td>
                  {e.status === 'concluida' && (e.arquivo_path
                    ? <button type="button" className="botao-secundario" onClick={() => baixar(e)}>Baixar ZIP</button>
                    : <span className="meta">Substituída por uma mais recente</span>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
