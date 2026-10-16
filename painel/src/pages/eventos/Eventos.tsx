// Agenda: eventos da cidade e agenda de autoridades.
import { useEffect, useState, type FormEvent } from 'react';
import { ListaConteudo } from '../../components/ListaConteudo';
import { useEdicao, useOpcoes } from '../../lib/edicao';
import type { Midia } from '../../lib/midias';
import { dataHora, deInputDataHora, paraInputDataHora, SLUG_VALIDO, slugificar } from '../../lib/texto';
import { usePortal } from '../../lib/portal';
import { EditorTexto } from '../../components/EditorTexto';
import { CampoImagem } from '../../components/CampoImagem';
import { BarraAcoes, CabecalhoEdicao, CampoSlug, CarregandoOuAusente, MensagensEdicao, Obrigatorio, SeletorOrgao } from '../../components/Edicao';

export function ListaEventos() {
  return (
    <ListaConteudo titulo="Agenda" tabela="eventos" rotaBase="/eventos" rotuloNovo="Novo evento"
      select="titulo, inicio_em, local, tipo, atualizado_em" campoTitulo="titulo" ordem={[{ coluna: 'inicio_em' }]}
      colunas={[
        { rotulo: 'Evento', render: (l) => l.titulo },
        { rotulo: 'Início', render: (l) => dataHora(l.inicio_em) },
        { rotulo: 'Local', render: (l) => l.local ?? '—' },
        { rotulo: 'Tipo', render: (l) => l.tipo === 'agenda_autoridade' ? 'Agenda de autoridade' : 'Evento' },
      ]}
      vazio="Nenhum evento cadastrado." />
  );
}

interface Form {
  tipo: 'evento' | 'agenda_autoridade'; categoriaId: string; titulo: string; slug: string; resumo: string; descricao: string;
  inicio: string; fim: string; diaInteiro: boolean; local: string; endereco: string; urlExterna: string; orgaoId: string; imagem: Midia | null;
}
const CAMPOS_MIDIA = 'id, storage_path, nome_original, mime_type, texto_alternativo';

export function EditarEvento() {
  const portal = usePortal();
  const { categorias, orgaos } = useOpcoes('evento');
  const [slugManual, setSlugManual] = useState(false);
  const e = useEdicao<Form>({
    tabela: 'eventos',
    rotaBase: '/eventos',
    select: `*, imagem:midias!eventos_imagem_id_municipio_id_fkey(${CAMPOS_MIDIA})`,
    vazio: { tipo: 'evento', categoriaId: '', titulo: '', slug: '', resumo: '', descricao: '', inicio: '', fim: '', diaInteiro: false, local: '', endereco: '', urlExterna: '', orgaoId: '', imagem: null },
    deLinha: (d) => ({
      tipo: d.tipo, categoriaId: d.categoria_id ?? '', titulo: d.titulo, slug: d.slug, resumo: d.resumo ?? '', descricao: d.descricao_html ?? '',
      inicio: paraInputDataHora(d.inicio_em), fim: paraInputDataHora(d.fim_em), diaInteiro: d.dia_inteiro, local: d.local ?? '',
      endereco: d.endereco ?? '', urlExterna: d.url_externa ?? '', orgaoId: d.orgao_id ?? '', imagem: d.imagem ?? null,
    }),
    paraLinha: (f) => ({
      tipo: f.tipo, categoria_id: f.categoriaId || null, titulo: f.titulo.trim(), slug: f.slug, resumo: f.resumo.trim() || null,
      descricao_html: f.descricao || null, inicio_em: deInputDataHora(f.inicio), fim_em: deInputDataHora(f.fim), dia_inteiro: f.diaInteiro,
      local: f.local.trim() || null, endereco: f.endereco.trim() || null, url_externa: f.urlExterna.trim() || null,
      orgao_id: f.orgaoId || null, imagem_id: f.imagem?.id ?? null,
    }),
    validar: (f) => [
      !f.titulo.trim() && 'Informe o nome do evento.',
      !SLUG_VALIDO.test(f.slug) && 'O endereço só pode ter letras minúsculas, números e hífens.',
      !f.inicio && 'Informe a data e hora de início.',
      f.inicio && f.fim && new Date(f.fim) < new Date(f.inicio) && 'O término precisa ser depois do início.',
      f.imagem && !f.imagem.texto_alternativo?.trim() && 'A imagem precisa de texto alternativo.',
    ].filter(Boolean) as string[],
    mensagens: { salvar: 'Alterações salvas.', publicar: 'Evento publicado.', agendar: 'Publicação agendada para', despublicar: 'Evento retirado do site.' },
  });
  const { f, mudar } = e;
  useEffect(() => { if (e.linha) setSlugManual(true); }, [e.linha]);
  useEffect(() => { if (!slugManual) mudar('slug', slugificar(f.titulo)); }, [f.titulo, slugManual, mudar]);

  const enviar = (ev: FormEvent) => { ev.preventDefault(); e.salvar('salvar'); };
  return (
    <CarregandoOuAusente e={e} rotuloLista="Agenda">
      <form onSubmit={enviar} className="formulario-conteudo" noValidate>
        <CabecalhoEdicao e={e} rotuloLista="Agenda" titulo={e.nova ? 'Novo evento' : f.titulo || 'Sem título'} linkSite={portal && `${portal}/eventos/${f.slug}`} previa={{ tabela: 'eventos', portal }} />
        <MensagensEdicao e={e} nome="evento" />
        <fieldset disabled={e.bloqueado || e.salvando} className="grade-formulario">
          <div className="coluna-principal">
            <label><Obrigatorio>Nome do evento</Obrigatorio><input value={f.titulo} onChange={(ev) => mudar('titulo', ev.target.value)} maxLength={200} /></label>
            <CampoSlug prefixo="/eventos/" valor={f.slug} travado={e.jaPublicado} aoMudar={(v) => { setSlugManual(true); mudar('slug', v); }} />
            <div className="linha-campos">
              <label><Obrigatorio>Início</Obrigatorio><input type="datetime-local" value={f.inicio} onChange={(ev) => mudar('inicio', ev.target.value)} /></label>
              <label>Término<input type="datetime-local" value={f.fim} onChange={(ev) => mudar('fim', ev.target.value)} /></label>
            </div>
            <label className="opcao"><input type="checkbox" checked={f.diaInteiro} onChange={(ev) => mudar('diaInteiro', ev.target.checked)} /> Dia inteiro (não mostrar horário)</label>
            <div className="linha-campos">
              <label>Local<input value={f.local} onChange={(ev) => mudar('local', ev.target.value)} placeholder="Ex.: Praça Central" /></label>
              <label>Endereço<input value={f.endereco} onChange={(ev) => mudar('endereco', ev.target.value)} /></label>
            </div>
            <label>Resumo<textarea rows={2} value={f.resumo} onChange={(ev) => mudar('resumo', ev.target.value)} maxLength={300} /></label>
            <div className="campo">
              <span className="rotulo-campo">Descrição</span>
              <EditorTexto rotulo="Descrição do evento" valor={f.descricao} aoMudar={(v) => mudar('descricao', v)} municipioId={e.mid} desabilitado={e.bloqueado} />
            </div>
          </div>
          <div className="coluna-lateral">
            <label>Tipo
              <select value={f.tipo} onChange={(ev) => mudar('tipo', ev.target.value as Form['tipo'])}>
                <option value="evento">Evento da cidade</option>
                <option value="agenda_autoridade">Agenda de autoridade</option>
              </select>
            </label>
            <label>Categoria
              <select value={f.categoriaId} onChange={(ev) => mudar('categoriaId', ev.target.value)}>
                <option value="">—</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <SeletorOrgao orgaos={orgaos} valor={f.orgaoId} aoMudar={(v) => mudar('orgaoId', v)} />
            <CampoImagem rotulo="Imagem" municipioId={e.mid} midia={f.imagem} aoMudar={(m) => mudar('imagem', m)} desabilitado={e.bloqueado} />
            <label>Link de inscrição ou transmissão<input type="url" value={f.urlExterna} onChange={(ev) => mudar('urlExterna', ev.target.value)} placeholder="https://" /></label>
          </div>
        </fieldset>
        <BarraAcoes e={e} />
      </form>
    </CarregandoOuAusente>
  );
}
