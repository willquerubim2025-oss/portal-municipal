// Vídeos explicativos do serviço (D-116 a D-120; colunas servicos.videos e servicos.videos_titulo, migrações 0028 e 0029).
// Envia o vídeo para a pasta da organização no bucket "midias" (o banco recusa outra pasta), gera a capa sozinho a
// partir do 1º segundo e permite ordenar, renomear, trocar a capa e escrever o texto de apoio com links que o portal
// mostra ao lado de cada vídeo. Campos que o painel não conhece são mantidos como estão.
import { useId, useState } from 'react';
import { enviarMidia } from '../lib/midias';
import { mensagemErro, urlMidia } from '../lib/supabase';

export interface LinkApoio { rotulo: string; url: string }
export interface ApoioVideo { titulo?: string; texto?: string; links?: LinkApoio[] }
export interface VideoServico { titulo: string; caminho: string; capa?: string; apoio?: ApoioVideo; [extra: string]: unknown }

export const MAXIMO_VIDEOS = 6; // o mesmo limite do CHECK da migração 0028
export const MAXIMO_LINKS = 3;
const LIMITE_VIDEO = 50 * 1024 * 1024;
const TIPOS_VIDEO = 'video/mp4,video/webm';

/** Endereço aceito pelo portal nos links de apoio: da web (http/https) ou do próprio portal (/...). */
export const urlApoioValida = (u: string) => /^https?:\/\/\S+$/i.test(u) || (u.startsWith('/') && !u.startsWith('//'));

/** Erros dos vídeos, para a validação do formulário. */
export function errosVideos(videos: VideoServico[], titulo: string): string[] {
  const erros: string[] = [];
  if (titulo.trim().length > 80) erros.push('O título da seção de vídeos pode ter até 80 caracteres.');
  if (videos.length > MAXIMO_VIDEOS) erros.push(`São no máximo ${MAXIMO_VIDEOS} vídeos por serviço.`);
  videos.forEach((v, i) => {
    const n = `Vídeo ${i + 1}`;
    if (!v.titulo.trim()) erros.push(`${n}: informe o título.`);
    (v.apoio?.links ?? []).forEach((l) => {
      if (!l.rotulo.trim() && !l.url.trim()) return; // linha vazia: descartada ao salvar
      if (!l.rotulo.trim()) erros.push(`${n}: um link está sem o texto do botão.`);
      if (!urlApoioValida(l.url.trim())) erros.push(`${n}: o link "${l.rotulo.trim() || l.url}" deve começar com https:// ou /.`);
    });
  });
  return erros;
}

/** Lista limpa para gravar: sem espaços sobrando, sem links vazios e sem apoio vazio. */
export function videosParaGravar(videos: VideoServico[]): VideoServico[] {
  return videos.map(({ apoio, ...v }) => {
    const titulo = apoio?.titulo?.trim() ?? '';
    const texto = apoio?.texto?.trim() ?? '';
    const links = (apoio?.links ?? []).map((l) => ({ rotulo: l.rotulo.trim(), url: l.url.trim() })).filter((l) => l.rotulo || l.url);
    const limpo: VideoServico = { ...v, titulo: v.titulo.trim() };
    if (titulo || texto || links.length) {
      const { titulo: _t, texto: _x, links: _l, ...outros } = apoio ?? {};
      limpo.apoio = { ...outros, ...(titulo && { titulo }), ...(texto && { texto }), ...(links.length && { links }) };
    }
    return limpo;
  });
}

/** Capa tirada do vídeo (1º segundo, ou o meio de vídeos mais curtos), em JPG. Null se o navegador não conseguir. */
async function capaDoVideo(arquivo: File): Promise<File | null> {
  const url = URL.createObjectURL(arquivo);
  try {
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.preload = 'auto'; video.src = url;
    await new Promise<void>((ok, falha) => { video.onloadeddata = () => ok(); video.onerror = () => falha(new Error('vídeo')); });
    await new Promise<void>((ok) => { video.onseeked = () => ok(); video.currentTime = Math.min(1, (video.duration || 2) / 2); });
    const escala = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * escala); canvas.height = Math.round(video.videoHeight * escala);
    if (!canvas.width || !canvas.height) return null;
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
    if (!blob) return null;
    const base = arquivo.name.replace(/\.[^.]+$/, '') || 'video';
    return new File([blob], `${base}-capa.jpg`, { type: 'image/jpeg' });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface Props {
  municipioId: string;
  videos: VideoServico[];
  titulo: string;
  aoMudar: (videos: VideoServico[]) => void;
  aoMudarTitulo: (titulo: string) => void;
  desabilitado?: boolean;
}

export function CampoVideos({ municipioId, videos, titulo, aoMudar, aoMudarTitulo, desabilitado = false }: Props) {
  const id = useId();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [chaveArquivo, setChaveArquivo] = useState(0); // limpa o campo de arquivo depois do envio

  const trocar = (i: number, v: VideoServico) => aoMudar(videos.map((x, j) => (j === i ? v : x)));
  const mover = (i: number, d: -1 | 1) => {
    const lista = [...videos];
    [lista[i], lista[i + d]] = [lista[i + d], lista[i]];
    aoMudar(lista);
  };

  async function enviar() {
    if (!arquivo) return;
    if (!novoTitulo.trim()) { setErro('Informe o título do vídeo antes de enviar.'); return; }
    if (!arquivo.type.startsWith('video/')) { setErro('Escolha um arquivo de vídeo (MP4 ou WebM).'); return; }
    if (arquivo.size > LIMITE_VIDEO) { setErro('O vídeo passa de 50 MB. Diminua a resolução ou o tamanho antes de enviar.'); return; }
    setErro(null); setAviso(null);
    try {
      setEnviando('Enviando o vídeo…');
      const video = await enviarMidia(municipioId, arquivo, null);
      const novo: VideoServico = { titulo: novoTitulo.trim(), caminho: video.storage_path };
      setEnviando('Preparando a capa…');
      const capa = await capaDoVideo(arquivo);
      if (capa) novo.capa = (await enviarMidia(municipioId, capa, `Capa do vídeo: ${novoTitulo.trim()}`)).storage_path;
      aoMudar([...videos, novo]);
      setArquivo(null); setNovoTitulo(''); setChaveArquivo((k) => k + 1);
      setAviso(capa ? 'Vídeo enviado. Salve o serviço para guardar a mudança.' : 'Vídeo enviado, mas a capa não pôde ser gerada; escolha uma imagem de capa. Salve o serviço para guardar a mudança.');
    } catch (e) { setErro(mensagemErro(e)); }
    setEnviando(null);
  }

  async function trocarCapa(i: number, imagem: File | undefined) {
    if (!imagem) return;
    if (!/^image\/(jpeg|png|webp)$/.test(imagem.type)) { setErro('A capa deve ser JPG, PNG ou WebP.'); return; }
    setErro(null); setAviso(null); setEnviando('Enviando a capa…');
    try {
      const m = await enviarMidia(municipioId, imagem, `Capa do vídeo: ${videos[i].titulo}`);
      trocar(i, { ...videos[i], capa: m.storage_path });
      setAviso('Capa trocada. Salve o serviço para guardar a mudança.');
    } catch (e) { setErro(mensagemErro(e)); }
    setEnviando(null);
  }

  const apoio = (v: VideoServico): ApoioVideo => v.apoio ?? {};
  const mudarApoio = (i: number, a: ApoioVideo) => trocar(i, { ...videos[i], apoio: a });
  const ocupado = desabilitado || !!enviando;

  return (
    <fieldset className="campo-videos" disabled={desabilitado} aria-describedby={`${id}-ajuda`}>
      <legend>Vídeos explicativos (opcional)</legend>
      <p id={`${id}-ajuda`} className="meta">
        Aparecem na página do serviço, logo depois da foto de capa, com o vídeo à esquerda e o texto de apoio à direita.
        Use vídeos com legenda gravada. Até {MAXIMO_VIDEOS} vídeos (MP4 ou WebM, até 50 MB cada).
      </p>
      <label>Título da seção
        <input value={titulo} maxLength={80} onChange={(ev) => aoMudarTitulo(ev.target.value)} placeholder="Vídeos explicativos" aria-describedby={`${id}-titulo-ajuda`} />
      </label>
      <small id={`${id}-titulo-ajuda`}>Ex.: Inscrição para creche. Em branco, o site mostra "Vídeos explicativos".</small>

      {videos.length > 0 && (
        <ol className="lista-videos">
          {videos.map((v, i) => {
            const a = apoio(v);
            const links = a.links ?? [];
            return (
              <li key={`${v.caminho}-${i}`} className="video-item">
                <div className="video-previa">
                  <video controls preload="none" src={urlMidia(v.caminho) ?? undefined} poster={v.capa ? urlMidia(v.capa) ?? undefined : undefined} aria-label={`Prévia: ${v.titulo || `vídeo ${i + 1}`}`} />
                  <label className="botao-link video-capa">Trocar a capa
                    <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" disabled={ocupado} onChange={(ev) => { trocarCapa(i, ev.target.files?.[0]); ev.target.value = ''; }} />
                  </label>
                </div>
                <div className="video-campos">
                  <label>Título do vídeo (obrigatório)
                    <input value={v.titulo} maxLength={120} onChange={(ev) => trocar(i, { ...v, titulo: ev.target.value })} />
                  </label>
                  <fieldset className="video-apoio">
                    <legend>Texto ao lado do vídeo (opcional)</legend>
                    <label>Título<input value={a.titulo ?? ''} maxLength={120} onChange={(ev) => mudarApoio(i, { ...a, titulo: ev.target.value })} placeholder="Ex.: Faça a inscrição no SISS" /></label>
                    <label>Texto<textarea rows={3} value={a.texto ?? ''} maxLength={600} onChange={(ev) => mudarApoio(i, { ...a, texto: ev.target.value })} /></label>
                    {links.map((l, k) => (
                      <div key={k} className="video-link" role="group" aria-label={`Link ${k + 1}`}>
                        <label>{k === 0 ? 'Botão' : `Link ${k + 1}`}
                          <input value={l.rotulo} maxLength={80} onChange={(ev) => mudarApoio(i, { ...a, links: links.map((x, j) => (j === k ? { ...x, rotulo: ev.target.value } : x)) })} placeholder="Ex.: Fazer a inscrição" />
                        </label>
                        <label>Endereço
                          <input inputMode="url" value={l.url} onChange={(ev) => mudarApoio(i, { ...a, links: links.map((x, j) => (j === k ? { ...x, url: ev.target.value } : x)) })} placeholder="https://" />
                        </label>
                        <button type="button" className="botao-link perigo" onClick={() => mudarApoio(i, { ...a, links: links.filter((_, j) => j !== k) })}>
                          Remover<span className="sr-only"> o link {k + 1} do vídeo {i + 1}</span>
                        </button>
                      </div>
                    ))}
                    {links.length < MAXIMO_LINKS && (
                      <button type="button" className="botao-link" onClick={() => mudarApoio(i, { ...a, links: [...links, { rotulo: '', url: '' }] })}>
                        {links.length ? 'Adicionar outro link' : 'Adicionar botão'}<span className="sr-only"> ao vídeo {i + 1}</span>
                      </button>
                    )}
                    <small>O primeiro link aparece como botão; os outros, como links simples. Links para outros sites abrem em nova aba.</small>
                  </fieldset>
                  <div className="imagem-opcoes">
                    <button type="button" className="botao-link" disabled={i === 0} onClick={() => mover(i, -1)}>Subir<span className="sr-only"> o vídeo {i + 1}</span></button>
                    <button type="button" className="botao-link" disabled={i === videos.length - 1} onClick={() => mover(i, 1)}>Descer<span className="sr-only"> o vídeo {i + 1}</span></button>
                    <button type="button" className="botao-link perigo" onClick={() => aoMudar(videos.filter((_, j) => j !== i))}>Tirar do serviço<span className="sr-only">: vídeo {i + 1}</span></button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {videos.length < MAXIMO_VIDEOS ? (
        <div className="video-novo">
          <h3>Adicionar vídeo</h3>
          <label>Título do vídeo<input value={novoTitulo} maxLength={120} onChange={(ev) => setNovoTitulo(ev.target.value)} placeholder="Ex.: Como fazer a inscrição no SISS" /></label>
          <label htmlFor={`${id}-arq`}>Arquivo (MP4 ou WebM, até 50 MB)</label>
          <input key={chaveArquivo} id={`${id}-arq`} type="file" accept={TIPOS_VIDEO} onChange={(ev) => setArquivo(ev.target.files?.[0] ?? null)} />
          <button type="button" className="botao-secundario" onClick={enviar} disabled={!arquivo || ocupado}>{enviando ?? 'Enviar vídeo'}</button>
        </div>
      ) : <p className="meta">Limite de {MAXIMO_VIDEOS} vídeos atingido.</p>}
      <div aria-live="polite">{aviso && <p className="sucesso">{aviso}</p>}</div>
      {erro && <p className="erro" role="alert">{erro}</p>}
    </fieldset>
  );
}
