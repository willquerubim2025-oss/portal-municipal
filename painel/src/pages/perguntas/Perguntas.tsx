// Perguntas frequentes (LAI art. 8º §1º VI).
import type { FormEvent } from 'react';
import { ListaConteudo } from '../../components/ListaConteudo';
import { useEdicao, useOpcoes } from '../../lib/edicao';
import { usePortal } from '../../lib/portal';
import { EditorTexto } from '../../components/EditorTexto';
import { BarraAcoes, CabecalhoEdicao, CarregandoOuAusente, MensagensEdicao, Obrigatorio, SeletorOrgao } from '../../components/Edicao';

export function ListaPerguntas() {
  return (
    <ListaConteudo titulo="Perguntas frequentes" tabela="perguntas_frequentes" rotaBase="/perguntas" rotuloNovo="Nova pergunta"
      select="pergunta, ordem, atualizado_em, categoria:categorias(nome)" campoTitulo="pergunta" ordem={[{ coluna: 'ordem', asc: true }]}
      colunas={[
        { rotulo: 'Pergunta', render: (l) => l.pergunta },
        { rotulo: 'Categoria', render: (l) => l.categoria?.nome ?? '—' },
        { rotulo: 'Ordem', render: (l) => l.ordem },
      ]}
      vazio="Nenhuma pergunta cadastrada." />
  );
}

interface Form { categoriaId: string; pergunta: string; resposta: string; orgaoId: string; ordem: string }

export function EditarPergunta() {
  const portal = usePortal();
  const { categorias, orgaos } = useOpcoes('pergunta');
  const e = useEdicao<Form>({
    tabela: 'perguntas_frequentes',
    rotaBase: '/perguntas',
    select: '*',
    vazio: { categoriaId: '', pergunta: '', resposta: '', orgaoId: '', ordem: '0' },
    deLinha: (d) => ({ categoriaId: d.categoria_id ?? '', pergunta: d.pergunta, resposta: d.resposta_html ?? '', orgaoId: d.orgao_id ?? '', ordem: String(d.ordem ?? 0) }),
    paraLinha: (f) => ({ categoria_id: f.categoriaId || null, pergunta: f.pergunta.trim(), resposta_html: f.resposta, orgao_id: f.orgaoId || null, ordem: Number(f.ordem) || 0 }),
    validar: (f) => [!f.pergunta.trim() && 'Escreva a pergunta.', !f.resposta.trim() && 'Escreva a resposta.'].filter(Boolean) as string[],
    mensagens: { salvar: 'Alterações salvas.', publicar: 'Pergunta publicada.', agendar: 'Publicação agendada para', despublicar: 'Pergunta retirada do site.' },
  });
  const { f, mudar } = e;
  const enviar = (ev: FormEvent) => { ev.preventDefault(); e.salvar('salvar'); };
  return (
    <CarregandoOuAusente e={e} rotuloLista="Perguntas frequentes">
      <form onSubmit={enviar} className="formulario-conteudo" noValidate>
        <CabecalhoEdicao e={e} rotuloLista="Perguntas frequentes" titulo={e.nova ? 'Nova pergunta' : f.pergunta || 'Sem título'}
          linkSite={portal && e.id ? `${portal}/perguntas-frequentes#${e.id}` : null} />
        <MensagensEdicao e={e} nome="pergunta" />
        <fieldset disabled={e.bloqueado || e.salvando} className="grade-formulario">
          <div className="coluna-principal">
            <label><Obrigatorio>Pergunta</Obrigatorio><input value={f.pergunta} onChange={(ev) => mudar('pergunta', ev.target.value)} maxLength={300} placeholder="Ex.: Como emitir a segunda via do IPTU?" /></label>
            <div className="campo">
              <span className="rotulo-campo"><Obrigatorio>Resposta</Obrigatorio></span>
              <EditorTexto rotulo="Resposta" valor={f.resposta} aoMudar={(v) => mudar('resposta', v)} municipioId={e.mid} desabilitado={e.bloqueado} />
            </div>
          </div>
          <div className="coluna-lateral">
            <label>Categoria
              <select value={f.categoriaId} onChange={(ev) => mudar('categoriaId', ev.target.value)}>
                <option value="">—</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <SeletorOrgao orgaos={orgaos} valor={f.orgaoId} aoMudar={(v) => mudar('orgaoId', v)} />
            <label>Ordem<input type="number" value={f.ordem} onChange={(ev) => mudar('ordem', ev.target.value)} /></label>
          </div>
        </fieldset>
        <BarraAcoes e={e} />
      </form>
    </CarregandoOuAusente>
  );
}
