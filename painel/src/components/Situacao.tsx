import type { Status } from '../lib/tipos';

/** Situação efetiva: "publicado" com data futura é "agendado". */
export function situacao(status: Status, publicadoEm: string | null): 'rascunho' | 'agendado' | 'publicado' | 'despublicado' {
  if (status === 'publicado' && publicadoEm && new Date(publicadoEm) > new Date()) return 'agendado';
  return status;
}

const ROTULO = { rascunho: 'Rascunho', agendado: 'Agendado', publicado: 'Publicado', despublicado: 'Despublicado' };

export function EtiquetaSituacao({ status, publicadoEm }: { status: Status; publicadoEm: string | null }) {
  const s = situacao(status, publicadoEm);
  return <span className={`etiqueta etiqueta-${s}`}>{ROTULO[s]}</span>;
}
