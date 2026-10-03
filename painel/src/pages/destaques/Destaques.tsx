// Banners da página inicial e alertas (ex.: Defesa Civil). Ficam no ar da publicação até "fim".
import type { FormEvent } from 'react';
import { ListaConteudo } from '../../components/ListaConteudo';
import { useEdicao } from '../../lib/edicao';
import type { Midia } from '../../lib/midias';
import { dataHora, deInputDataHora, paraInputDataHora } from '../../lib/texto';
import { CampoImagem } from '../../components/CampoImagem';
import { BarraAcoes, CabecalhoEdicao, CarregandoOuAusente, MensagensEdicao, Obrigatorio } from '../../components/Edicao';

const NIVEIS = { informativo: 'Informativo (azul)', atencao: 'Atenção (amarelo)', urgente: 'Urgente (vermelho)' } as const;

export function ListaDestaques() {
  return (
    <ListaConteudo titulo="Banners e alertas" tabela="destaques" rotaBase="/destaques" rotuloNovo="Novo banner ou alerta"
      select="titulo, tipo, nivel, fim_em, ordem, atualizado_em" campoTitulo="titulo" ordem={[{ coluna: 'ordem', asc: true }, { coluna: 'atualizado_em' }]}
      colunas={[
        { rotulo: 'Título', render: (l) => l.titulo },
        { rotulo: 'Tipo', render: (l) => l.tipo === 'alerta' ? `Alerta · ${NIVEIS[l.nivel as keyof typeof NIVEIS]?.split(' ')[0]}` : 'Banner' },
        { rotulo: 'Sai do ar em', render: (l) => l.fim_em ? dataHora(l.fim_em) : 'sem prazo' },
      ]}
      vazio="Nenhum banner ou alerta." />
  );
}

interface Form { tipo: 'banner' | 'alerta'; nivel: keyof typeof NIVEIS; titulo: string; texto: string; imagem: Midia | null; url: string; novaAba: boolean; fim: string; ordem: string }
const CAMPOS_MIDIA = 'id, storage_path, nome_original, mime_type, texto_alternativo';

export function EditarDestaque() {
  const e = useEdicao<Form>({
    tabela: 'destaques',
    rotaBase: '/destaques',
    select: `*, imagem:midias(${CAMPOS_MIDIA})`,
    vazio: { tipo: 'banner', nivel: 'informativo', titulo: '', texto: '', imagem: null, url: '', novaAba: false, fim: '', ordem: '0' },
    deLinha: (d) => ({
      tipo: d.tipo, nivel: d.nivel, titulo: d.titulo, texto: d.texto ?? '', imagem: d.imagem ?? null, url: d.url ?? '',
      novaAba: d.nova_aba, fim: paraInputDataHora(d.fim_em), ordem: String(d.ordem ?? 0),
    }),
    paraLinha: (f) => ({
      tipo: f.tipo, nivel: f.nivel, titulo: f.titulo.trim(), texto: f.texto.trim() || null, imagem_id: f.imagem?.id ?? null,
      url: f.url.trim() || null, nova_aba: f.novaAba, fim_em: deInputDataHora(f.fim), ordem: Number(f.ordem) || 0,
    }),
    validar: (f) => [
      !f.titulo.trim() && 'Informe o título.',
      f.imagem && !f.imagem.texto_alternativo?.trim() && 'A imagem precisa de texto alternativo.',
      f.url.trim() && !/^(https?:\/\/|\/)/.test(f.url.trim()) && 'O link deve começar com https:// ou com / (página do próprio portal).',
      f.fim && new Date(f.fim) <= new Date() && 'A data de saída do ar já passou.',
    ].filter(Boolean) as string[],
    validarPublicacao: (f) => (f.tipo === 'banner' && !f.imagem ? ['Para publicar um banner, envie a imagem.'] : []),
    mensagens: { salvar: 'Alterações salvas.', publicar: 'No ar.', agendar: 'Entra no ar em', despublicar: 'Retirado do ar.' },
  });
  const { f, mudar } = e;
  const enviar = (ev: FormEvent) => { ev.preventDefault(); e.salvar('salvar'); };
  return (
    <CarregandoOuAusente e={e} rotuloLista="Banners e alertas">
      <form onSubmit={enviar} className="formulario-conteudo" noValidate>
        <CabecalhoEdicao e={e} rotuloLista="Banners e alertas" titulo={e.nova ? 'Novo banner ou alerta' : f.titulo || 'Sem título'} />
        <MensagensEdicao e={e} nome="destaque" />
        <fieldset disabled={e.bloqueado || e.salvando} className="grade-formulario">
          <div className="coluna-principal">
            <fieldset>
              <legend>Tipo</legend>
              <label className="opcao"><input type="radio" name="tipo" checked={f.tipo === 'banner'} onChange={() => mudar('tipo', 'banner')} /> Banner com imagem (carrossel da página inicial)</label>
              <label className="opcao"><input type="radio" name="tipo" checked={f.tipo === 'alerta'} onChange={() => mudar('tipo', 'alerta')} /> Alerta em faixa (aparece no topo de todas as páginas)</label>
            </fieldset>
            <label><Obrigatorio>Título</Obrigatorio><input value={f.titulo} onChange={(ev) => mudar('titulo', ev.target.value)} maxLength={120} /></label>
            {f.tipo === 'alerta' && (
              <>
                <label>Texto<input value={f.texto} onChange={(ev) => mudar('texto', ev.target.value)} maxLength={200} /></label>
                <label>Nível
                  <select value={f.nivel} onChange={(ev) => mudar('nivel', ev.target.value as Form['nivel'])}>
                    {Object.entries(NIVEIS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                  </select>
                </label>
              </>
            )}
            <label>Link (opcional)<input value={f.url} onChange={(ev) => mudar('url', ev.target.value)} placeholder="/noticias/... ou https://..." /></label>
            <label className="opcao"><input type="checkbox" checked={f.novaAba} onChange={(ev) => mudar('novaAba', ev.target.checked)} /> Abrir o link em nova aba</label>
          </div>
          <div className="coluna-lateral">
            {f.tipo === 'banner' && <CampoImagem rotulo="Imagem do banner (larga, ex.: 1200 × 514)" municipioId={e.mid} midia={f.imagem} aoMudar={(m) => mudar('imagem', m)} desabilitado={e.bloqueado} />}
            <label>Sai do ar em (opcional)<input type="datetime-local" value={f.fim} onChange={(ev) => mudar('fim', ev.target.value)} /></label>
            <label>Ordem<input type="number" value={f.ordem} onChange={(ev) => mudar('ordem', ev.target.value)} /></label>
          </div>
        </fieldset>
        <BarraAcoes e={e} rotuloAgendar="Entrar no ar em" />
      </form>
    </CarregandoOuAusente>
  );
}
