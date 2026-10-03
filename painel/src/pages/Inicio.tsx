import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { usePortal } from '../lib/portal';

interface Resumo { rascunhos: number; agendadas: number; publicadas: number; saldo: number | null; limite: number | null }

export function Inicio() {
  const { atual, nome, podePublicar } = useAuth();
  const portal = usePortal();
  const [r, setR] = useState<Resumo | null>(null);
  const mid = atual!.municipio.id;

  useEffect(() => {
    let ativo = true;
    const conta = (filtro: (q: any) => any) =>
      filtro(supabase.from('publicacoes').select('id', { count: 'exact', head: true }).eq('municipio_id', mid)).then((x: any) => x.count ?? 0);
    const agora = new Date().toISOString();
    Promise.all([
      conta((q) => q.eq('status', 'rascunho')),
      conta((q) => q.eq('status', 'publicado').gt('publicado_em', agora)),
      conta((q) => q.eq('status', 'publicado').lte('publicado_em', agora)),
      supabase.from('saldo_solicitacoes').select('saldo, limite_solicitacoes').eq('municipio_id', mid).limit(1).maybeSingle(),
    ]).then(([rascunhos, agendadas, publicadas, saldo]) => {
      if (ativo) setR({ rascunhos, agendadas, publicadas, saldo: saldo.data?.saldo ?? null, limite: saldo.data?.limite_solicitacoes ?? null });
    });
    return () => { ativo = false; };
  }, [mid]);

  return (
    <>
      <h1>Olá{nome ? `, ${nome.split(' ')[0]}` : ''}</h1>
      <p>Você está editando o portal da <strong>{atual!.municipio.nome}</strong>.{' '}
        {portal && <a href={portal} target="_blank" rel="noopener">Ver o site<span className="sr-only"> (abre em nova aba)</span></a>}
      </p>
      <section aria-labelledby="t-resumo">
        <h2 id="t-resumo">Notícias e avisos</h2>
        {!r ? <p role="status">Carregando…</p> : (
          <ul className="indicadores">
            <li><strong>{r.rascunhos}</strong> rascunhos{!podePublicar && r.rascunhos > 0 && ' aguardando um publicador'}</li>
            <li><strong>{r.agendadas}</strong> agendadas</li>
            <li><strong>{r.publicadas}</strong> publicadas</li>
            {r.limite !== null && <li><strong>{r.saldo}</strong> de {r.limite} solicitações editoriais disponíveis no contrato</li>}
          </ul>
        )}
        <p><Link className="botao" to="/noticias/nova">Nova notícia</Link> <Link to="/noticias">Ver todas</Link></p>
      </section>
    </>
  );
}
