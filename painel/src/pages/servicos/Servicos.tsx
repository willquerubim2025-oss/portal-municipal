// Carta de Serviços ao Usuário (Lei 13.460/2017).
import { useEffect, useState, type FormEvent } from 'react';
import { ListaConteudo } from '../../components/ListaConteudo';
import { useEdicao, useOpcoes } from '../../lib/edicao';
import { SLUG_VALIDO, slugificar } from '../../lib/texto';
import { usePortal } from '../../lib/portal';
import { EditorTexto } from '../../components/EditorTexto';
import { BarraAcoes, CabecalhoEdicao, CampoSlug, CarregandoOuAusente, MensagensEdicao, Obrigatorio, SeletorOrgao } from '../../components/Edicao';

export function ListaServicos() {
  return (
    <ListaConteudo titulo="Carta de Serviços" tabela="servicos" rotaBase="/servicos" rotuloNovo="Novo serviço"
      select="titulo, atualizado_em, categoria:categorias(nome), orgao:orgaos(nome)" campoTitulo="titulo" ordem={[{ coluna: 'titulo', asc: true }]}
      colunas={[
        { rotulo: 'Serviço', render: (l) => l.titulo },
        { rotulo: 'Público', render: (l) => l.categoria?.nome ?? '—' },
        { rotulo: 'Órgão', render: (l) => l.orgao?.nome ?? '—' },
      ]}
      vazio="Nenhum serviço cadastrado." />
  );
}

interface Form {
  categoriaId: string; titulo: string; slug: string; descricao: string; publicoAlvo: string; requisitos: string; etapas: string;
  prazo: string; custo: string; canal: string; localHorario: string; urlExterna: string; orgaoId: string;
}

export function EditarServico() {
  const portal = usePortal();
  const { categorias, orgaos } = useOpcoes('servico');
  const [slugManual, setSlugManual] = useState(false);
  const e = useEdicao<Form>({
    tabela: 'servicos',
    rotaBase: '/servicos',
    select: '*',
    vazio: { categoriaId: '', titulo: '', slug: '', descricao: '', publicoAlvo: '', requisitos: '', etapas: '', prazo: '', custo: '', canal: '', localHorario: '', urlExterna: '', orgaoId: '' },
    deLinha: (d) => ({
      categoriaId: d.categoria_id ?? '', titulo: d.titulo, slug: d.slug, descricao: d.descricao ?? '', publicoAlvo: d.publico_alvo ?? '',
      requisitos: d.requisitos_html ?? '', etapas: d.etapas_html ?? '', prazo: d.prazo ?? '', custo: d.custo ?? '', canal: d.canal_atendimento ?? '',
      localHorario: d.local_horario ?? '', urlExterna: d.url_externa ?? '', orgaoId: d.orgao_id ?? '',
    }),
    paraLinha: (f) => ({
      categoria_id: f.categoriaId || null, titulo: f.titulo.trim(), slug: f.slug, descricao: f.descricao.trim() || null,
      publico_alvo: f.publicoAlvo.trim() || null, requisitos_html: f.requisitos || null, etapas_html: f.etapas || null,
      prazo: f.prazo.trim() || null, custo: f.custo.trim() || null, canal_atendimento: f.canal.trim() || null,
      local_horario: f.localHorario.trim() || null, url_externa: f.urlExterna.trim() || null, orgao_id: f.orgaoId || null,
    }),
    validar: (f) => [
      !f.titulo.trim() && 'Informe o nome do serviço.',
      !SLUG_VALIDO.test(f.slug) && 'O endereço só pode ter letras minúsculas, números e hífens.',
      f.urlExterna.trim() && !/^https?:\/\//.test(f.urlExterna.trim()) && 'O link do serviço on-line deve começar com https://.',
    ].filter(Boolean) as string[],
    mensagens: { salvar: 'Alterações salvas.', publicar: 'Serviço publicado.', agendar: 'Publicação agendada para', despublicar: 'Serviço retirado do site.' },
  });
  const { f, mudar } = e;
  useEffect(() => { if (e.linha) setSlugManual(true); }, [e.linha]);
  useEffect(() => { if (!slugManual) mudar('slug', slugificar(f.titulo)); }, [f.titulo, slugManual, mudar]);

  const texto = (campo: keyof Form, rotulo: string, ajuda?: string, max = 300) => (
    <div className="campo"><label>{rotulo}<input value={f[campo] as string} maxLength={max} aria-describedby={ajuda ? `ajuda-${String(campo)}` : undefined} onChange={(ev) => mudar(campo, ev.target.value)} /></label>{ajuda && <small id={`ajuda-${String(campo)}`}>{ajuda}</small>}</div>
  );
  const enviar = (ev: FormEvent) => { ev.preventDefault(); e.salvar('salvar'); };
  return (
    <CarregandoOuAusente e={e} rotuloLista="Serviços">
      <form onSubmit={enviar} className="formulario-conteudo" noValidate>
        <CabecalhoEdicao e={e} rotuloLista="Carta de Serviços" titulo={e.nova ? 'Novo serviço' : f.titulo || 'Sem título'} linkSite={portal && `${portal}/servicos/${f.slug}`} />
        <MensagensEdicao e={e} nome="serviço" />
        <fieldset disabled={e.bloqueado || e.salvando} className="grade-formulario">
          <div className="coluna-principal">
            <label><Obrigatorio>Nome do serviço</Obrigatorio><input value={f.titulo} onChange={(ev) => mudar('titulo', ev.target.value)} maxLength={200} placeholder="Ex.: Segunda via do IPTU" /></label>
            <CampoSlug prefixo="/servicos/" valor={f.slug} travado={e.jaPublicado} aoMudar={(v) => { setSlugManual(true); mudar('slug', v); }} />
            <label>O que é<textarea rows={3} value={f.descricao} onChange={(ev) => mudar('descricao', ev.target.value)} maxLength={500} /></label>
            {texto('publicoAlvo', 'Quem pode solicitar')}
            <div className="campo">
              <span className="rotulo-campo">Documentos e requisitos</span>
              <EditorTexto rotulo="Documentos e requisitos" valor={f.requisitos} aoMudar={(v) => mudar('requisitos', v)} municipioId={e.mid} desabilitado={e.bloqueado} />
            </div>
            <div className="campo">
              <span className="rotulo-campo">Como solicitar (etapas)</span>
              <EditorTexto rotulo="Como solicitar" valor={f.etapas} aoMudar={(v) => mudar('etapas', v)} municipioId={e.mid} desabilitado={e.bloqueado} />
            </div>
          </div>
          <div className="coluna-lateral">
            <label>Público
              <select value={f.categoriaId} onChange={(ev) => mudar('categoriaId', ev.target.value)}>
                <option value="">—</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <SeletorOrgao orgaos={orgaos} valor={f.orgaoId} aoMudar={(v) => mudar('orgaoId', v)} />
            {texto('prazo', 'Prazo', 'Ex.: imediato, até 15 dias úteis')}
            {texto('custo', 'Custo', 'Ex.: gratuito, taxa de R$ 20,00')}
            {texto('canal', 'Canal de atendimento', 'Ex.: internet, presencial, telefone')}
            {texto('localHorario', 'Local e horário')}
            <label>Link do serviço on-line<input type="url" value={f.urlExterna} onChange={(ev) => mudar('urlExterna', ev.target.value)} placeholder="https://" /></label>
          </div>
        </fieldset>
        <BarraAcoes e={e} />
      </form>
    </CarregandoOuAusente>
  );
}
