// Páginas institucionais, hierárquicas: o endereço é o da página-mãe + o próprio trecho
// (ex.: secretarias/saude/programas). Travado depois de publicado.
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ListaConteudo } from '../../components/ListaConteudo';
import { useEdicao } from '../../lib/edicao';
import { supabase } from '../../lib/supabase';
import { slugificar, SLUG_VALIDO } from '../../lib/texto';
import { usePortal } from '../../lib/portal';
import { EditorTexto } from '../../components/EditorTexto';
import { BarraAcoes, CabecalhoEdicao, CarregandoOuAusente, MensagensEdicao, Obrigatorio } from '../../components/Edicao';

export function ListaPaginas() {
  return (
    <ListaConteudo titulo="Páginas" tabela="paginas" rotaBase="/paginas" rotuloNovo="Nova página"
      select="titulo, caminho, ordem, atualizado_em" campoTitulo="titulo" ordem={[{ coluna: 'caminho', asc: true }]}
      colunas={[
        { rotulo: 'Título', render: (l) => l.titulo },
        { rotulo: 'Endereço', render: (l) => <code>/{l.caminho}</code> },
      ]}
      vazio="Nenhuma página encontrada." />
  );
}

interface Form { parentId: string; segmento: string; titulo: string; resumo: string; corpo: string; ordem: string }
interface Opcao { id: string; titulo: string; caminho: string }

export function EditarPagina() {
  const portal = usePortal();
  const [paginas, setPaginas] = useState<Opcao[]>([]);
  const [segManual, setSegManual] = useState(false);

  const e = useEdicao<Form>({
    tabela: 'paginas',
    rotaBase: '/paginas',
    select: '*',
    vazio: { parentId: '', segmento: '', titulo: '', resumo: '', corpo: '', ordem: '0' },
    deLinha: (d) => ({ parentId: d.parent_id ?? '', segmento: d.caminho.split('/').pop(), titulo: d.titulo, resumo: d.resumo ?? '', corpo: d.corpo_html ?? '', ordem: String(d.ordem ?? 0) }),
    paraLinha: (f) => ({
      parent_id: f.parentId || null, caminho: caminhoDe(f), titulo: f.titulo.trim(), resumo: f.resumo.trim() || null,
      corpo_html: f.corpo || null, ordem: Number(f.ordem) || 0,
    }),
    validar: (f) => [
      !f.titulo.trim() && 'Informe o título.',
      !SLUG_VALIDO.test(f.segmento) && 'O endereço só pode ter letras minúsculas, números e hífens.',
    ].filter(Boolean) as string[],
    mensagens: { salvar: 'Alterações salvas.', publicar: 'Página publicada.', agendar: 'Publicação agendada para', despublicar: 'Página retirada do site.' },
  });
  const { f, mudar } = e;

  useEffect(() => {
    supabase.from('paginas').select('id, titulo, caminho').eq('municipio_id', e.mid).order('caminho').then(({ data }) => setPaginas(data ?? []));
  }, [e.mid]);
  useEffect(() => { if (e.linha) setSegManual(true); }, [e.linha]);
  useEffect(() => { if (!segManual) mudar('segmento', slugificar(f.titulo)); }, [f.titulo, segManual, mudar]);

  // A própria página e as filhas dela não podem ser escolhidas como mãe (evita ciclo).
  const atualCaminho = e.linha?.caminho as string | undefined;
  const maes = useMemo(() => paginas.filter((p) => p.id !== e.id && !(atualCaminho && p.caminho.startsWith(`${atualCaminho}/`))), [paginas, e.id, atualCaminho]);
  function caminhoDe(x: Form) {
    const mae = paginas.find((p) => p.id === x.parentId);
    return mae ? `${mae.caminho}/${x.segmento}` : x.segmento;
  }
  const caminho = caminhoDe(f);

  const enviar = (ev: FormEvent) => { ev.preventDefault(); e.salvar('salvar'); };
  return (
    <CarregandoOuAusente e={e} rotuloLista="Páginas">
      <form onSubmit={enviar} className="formulario-conteudo" noValidate>
        <CabecalhoEdicao e={e} rotuloLista="Páginas" titulo={e.nova ? 'Nova página' : f.titulo || 'Sem título'} linkSite={portal && `${portal}/${caminho}`} />
        <MensagensEdicao e={e} nome="página" />
        <fieldset disabled={e.bloqueado || e.salvando} className="grade-formulario">
          <div className="coluna-principal">
            <label><Obrigatorio>Título</Obrigatorio><input value={f.titulo} onChange={(ev) => mudar('titulo', ev.target.value)} maxLength={200} /></label>
            <label>Resumo<textarea rows={2} value={f.resumo} onChange={(ev) => mudar('resumo', ev.target.value)} maxLength={300} /></label>
            <div className="campo">
              <span className="rotulo-campo">Conteúdo</span>
              <EditorTexto rotulo="Conteúdo da página" valor={f.corpo} aoMudar={(v) => mudar('corpo', v)} municipioId={e.mid} desabilitado={e.bloqueado} />
            </div>
          </div>
          <div className="coluna-lateral">
            <div className="campo"><label>Página-mãe
              <select value={f.parentId} disabled={e.jaPublicado} onChange={(ev) => mudar('parentId', ev.target.value)} aria-describedby="ajuda-mae">
                <option value="">Nenhuma (primeiro nível)</option>
                {maes.map((p) => <option key={p.id} value={p.id}>{p.titulo} (/{p.caminho})</option>)}
              </select></label>
              <small id="ajuda-mae">Define onde a página fica no endereço e na lista de subpáginas.</small>
            </div>
            <div className="campo"><label>Trecho do endereço
              <input value={f.segmento} readOnly={e.jaPublicado} onChange={(ev) => { setSegManual(true); mudar('segmento', slugificar(ev.target.value)); }} aria-describedby="ajuda-caminho" /></label>
              <small id="ajuda-caminho">Endereço completo: <code>/{caminho || '…'}</code>{e.jaPublicado && '. Não muda depois de publicado.'}</small>
            </div>
            <label>Ordem entre as irmãs<input type="number" value={f.ordem} onChange={(ev) => mudar('ordem', ev.target.value)} /></label>
          </div>
        </fieldset>
        <BarraAcoes e={e} />
      </form>
    </CarregandoOuAusente>
  );
}
