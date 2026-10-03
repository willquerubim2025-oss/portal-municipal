// Peças comuns das telas de edição (usadas com useEdicao).
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Edicao } from '../lib/edicao';
import { dataHora, slugificar } from '../lib/texto';
import { EtiquetaSituacao } from './Situacao';

export function CabecalhoEdicao<F>({ e, rotuloLista, titulo, linkSite }: {
  e: Edicao<F>; rotuloLista: string; titulo: string; linkSite?: string | null;
}) {
  return (
    <div className="cabecalho-tela">
      <div>
        <p className="migalha"><Link to={rotaLista()}>{rotuloLista}</Link></p>
        <h1>{titulo}</h1>
        {!e.nova && (
          <p className="meta">
            <EtiquetaSituacao status={e.status} publicadoEm={e.publicadoEm} />
            {e.sit === 'agendado' && ` para ${dataHora(e.publicadoEm)}`}
            {e.sit === 'publicado' && ` em ${dataHora(e.publicadoEm)}`}
            {e.atualizadoEm && ` · última alteração ${dataHora(e.atualizadoEm)}`}
            {e.sit === 'publicado' && linkSite && <> · <a href={linkSite} target="_blank" rel="noopener">Ver no site<span className="sr-only"> (abre em nova aba)</span></a></>}
          </p>
        )}
      </div>
    </div>
  );
  function rotaLista() { return location.pathname.replace(/\/[^/]+$/, ''); }
}

export function MensagensEdicao<F>({ e, nome }: { e: Edicao<F>; nome: string }) {
  return (
    <>
      {e.bloqueado && (
        <p className="aviso-bloqueio" role="note">
          Este conteúdo ({nome}) está publicado. Só um publicador ou administrador pode alterá-lo ou retirá-lo do site.
        </p>
      )}
      <div aria-live="polite">
        {e.erro && <p className="erro" role="alert">{e.erro}</p>}
        {e.aviso && <p className="sucesso" role="status">{e.aviso}</p>}
      </div>
    </>
  );
}

/** Endereço (slug): gerado do título até ser editado; travado depois de publicado. */
export function CampoSlug({ prefixo, valor, travado, aoMudar }: {
  prefixo: string; valor: string; travado: boolean; aoMudar: (v: string) => void;
}) {
  return (
    <div className="campo"><label>Endereço no site
      <span className="prefixo-slug">
        <span aria-hidden="true">{prefixo}</span>
        <input value={valor} readOnly={travado} aria-describedby="ajuda-slug" onChange={(ev) => aoMudar(slugificar(ev.target.value))} />
      </span></label>
      <small id="ajuda-slug">{travado
        ? 'O endereço não muda depois de publicado, para não quebrar links já compartilhados.'
        : 'Gerado a partir do título. Use letras minúsculas, números e hífens.'}</small>
    </div>
  );
}

export function BarraAcoes<F>({ e, rotuloAgendar = 'Agendar para', extra }: { e: Edicao<F>; rotuloAgendar?: string; extra?: ReactNode }) {
  if (e.bloqueado && !e.podePublicar) return null;
  const s = e.sit;
  return (
    <div className="barra-acoes">
      {!e.bloqueado && <button type="submit" className="botao-secundario" disabled={e.salvando}>{e.nova || e.status === 'rascunho' ? 'Salvar rascunho' : 'Salvar alterações'}</button>}
      {e.podePublicar && (
        <>
          {s !== 'publicado' && <button type="button" className="botao" disabled={e.salvando} onClick={() => e.salvar('publicar')}>Publicar agora</button>}
          {s !== 'publicado' && (
            <span className="agendar">
              <label>{rotuloAgendar} <input type="datetime-local" value={e.agendarPara} onChange={(ev) => e.setAgendarPara(ev.target.value)} /></label>
              <button type="button" className="botao-secundario" disabled={e.salvando || !e.agendarPara} onClick={() => e.salvar('agendar')}>Agendar</button>
            </span>
          )}
          {(s === 'publicado' || s === 'agendado') && <button type="button" className="botao-secundario" disabled={e.salvando} onClick={() => e.salvar('despublicar')}>Retirar do site</button>}
          {!e.nova && <button type="button" className="botao-perigo" disabled={e.salvando} onClick={e.excluir}>Excluir</button>}
        </>
      )}
      {extra}
      {!e.podePublicar && <p className="meta">Depois de salvar, um publicador revisa e publica.</p>}
    </div>
  );
}

/** Rótulo com asterisco de obrigatório (o asterisco é só visual). */
export function Obrigatorio({ children }: { children: ReactNode }) {
  return <span>{children} <span aria-hidden="true">*</span></span>;
}

export function SeletorOrgao({ orgaos, valor, aoMudar }: { orgaos: { id: string; nome: string }[]; valor: string; aoMudar: (v: string) => void }) {
  return (
    <label>Órgão responsável
      <select value={valor} onChange={(ev) => aoMudar(ev.target.value)}>
        <option value="">—</option>
        {orgaos.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
      </select>
    </label>
  );
}

export function CarregandoOuAusente<F>({ e, rotuloLista, children }: { e: Edicao<F>; rotuloLista: string; children: ReactNode }) {
  if (e.carregando) return <p role="status">Carregando…</p>;
  if (e.naoEncontrado) {
    return <><p className="erro" role="alert">{e.erro ?? 'Registro não encontrado nesta prefeitura.'}</p><Link to={location.pathname.replace(/\/[^/]+$/, '')}>Voltar para {rotuloLista}</Link></>;
  }
  return <>{children}</>;
}
