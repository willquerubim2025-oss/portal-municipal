import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from './supabase';

/** Endereço do portal do município em edição (para os links "ver no site"). */
export function usePortal(): string | null {
  const { atual } = useAuth();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (import.meta.env.DEV && import.meta.env.VITE_PORTAL_DEV) { setUrl(import.meta.env.VITE_PORTAL_DEV); return; }
    if (!atual) return;
    supabase.from('municipio_dominios').select('dominio').eq('municipio_id', atual.municipio.id)
      .eq('ambiente', 'producao').eq('principal', true).maybeSingle()
      .then(({ data }) => setUrl(data ? `https://${data.dominio}` : null));
  }, [atual]);
  return url;
}
