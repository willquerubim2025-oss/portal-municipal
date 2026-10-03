// Imagem de destaque: envia um arquivo novo com texto alternativo obrigatório,
// ou remove a atual. O texto alternativo da imagem já enviada pode ser corrigido.
import { useId, useState } from 'react';
import { enviarMidia, type Midia } from '../lib/midias';
import { mensagemErro, supabase, urlMidia } from '../lib/supabase';

interface Props {
  rotulo: string;
  municipioId: string;
  midia: Midia | null;
  aoMudar: (m: Midia | null) => void;
  desabilitado?: boolean;
}

export function CampoImagem({ rotulo, municipioId, midia, aoMudar, desabilitado = false }: Props) {
  const id = useId();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [alt, setAlt] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    if (!arquivo) return;
    if (!alt.trim()) { setErro('Descreva a imagem (texto alternativo) antes de enviar.'); return; }
    setEnviando(true); setErro(null);
    try {
      aoMudar(await enviarMidia(municipioId, arquivo, alt.trim()));
      setArquivo(null); setAlt('');
    } catch (e) { setErro(mensagemErro(e)); }
    setEnviando(false);
  }

  async function corrigirAlt(novo: string) {
    if (!midia) return;
    aoMudar({ ...midia, texto_alternativo: novo });
    await supabase.from('midias').update({ texto_alternativo: novo }).eq('id', midia.id);
  }

  return (
    <fieldset className="campo-imagem" disabled={desabilitado}>
      <legend>{rotulo}</legend>
      {midia ? (
        <div className="imagem-atual">
          <img src={urlMidia(midia.storage_path)!} alt={midia.texto_alternativo ?? ''} />
          <div>
            <label htmlFor={`${id}-alt`}>Texto alternativo</label>
            <input id={`${id}-alt`} defaultValue={midia.texto_alternativo ?? ''} onBlur={(e) => corrigirAlt(e.target.value.trim())} />
            <button type="button" className="botao-link" onClick={() => aoMudar(null)}>Remover imagem</button>
          </div>
        </div>
      ) : (
        <div className="imagem-nova">
          <label htmlFor={`${id}-arq`}>Arquivo (JPG, PNG ou WebP)</label>
          <input id={`${id}-arq`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          {arquivo && (
            <>
              <label htmlFor={`${id}-alt`}>Descreva a imagem (texto alternativo, obrigatório)</label>
              <input id={`${id}-alt`} value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Ex.: Enfermeira aplica vacina em idosa na UBS Central" />
              <button type="button" className="botao-secundario" onClick={enviar} disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar imagem'}</button>
            </>
          )}
        </div>
      )}
      {erro && <p className="erro" role="alert">{erro}</p>}
    </fieldset>
  );
}
