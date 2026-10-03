import { supabase } from './supabase';

export interface Midia {
  id: string;
  storage_path: string;
  nome_original: string;
  mime_type: string;
  texto_alternativo: string | null;
  legenda?: string | null;
}

export const LIMITE_BYTES = 20 * 1024 * 1024; // 20 MB por arquivo

/** Nome seguro para o Storage: sem acento, espaço ou caractere especial. */
function nomeArquivo(nome: string): string {
  const ponto = nome.lastIndexOf('.');
  const base = (ponto > 0 ? nome.slice(0, ponto) : nome).normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'arquivo';
  const ext = ponto > 0 ? nome.slice(ponto + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  return ext ? `${base}.${ext}` : base;
}

/**
 * Envia o arquivo para midias/{municipio_id}/{ano}/{mes}/{uuid}-{nome} e cria a linha em `midias`.
 * O caminho nunca é reaproveitado: uma nova versão ganha um caminho novo (cache longo na borda).
 */
export async function enviarMidia(municipioId: string, arquivo: File, textoAlternativo: string | null): Promise<Midia> {
  if (arquivo.size > LIMITE_BYTES) throw new Error('Arquivo maior que 20 MB.');
  const agora = new Date();
  const caminho = `${municipioId}/${agora.getFullYear()}/${String(agora.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}-${nomeArquivo(arquivo.name)}`;
  const envio = await supabase.storage.from('midias').upload(caminho, arquivo, {
    contentType: arquivo.type || 'application/octet-stream',
    cacheControl: '31536000',
    upsert: false,
  });
  if (envio.error) throw envio.error;
  const { data, error } = await supabase.from('midias').insert({
    municipio_id: municipioId,
    storage_path: caminho,
    nome_original: arquivo.name,
    mime_type: arquivo.type || 'application/octet-stream',
    tamanho_bytes: arquivo.size,
    texto_alternativo: textoAlternativo,
  }).select('id, storage_path, nome_original, mime_type, texto_alternativo').single();
  if (error) {
    await supabase.storage.from('midias').remove([caminho]); // não deixa arquivo órfão
    throw error;
  }
  return data as Midia;
}
