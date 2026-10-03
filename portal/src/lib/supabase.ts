import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from 'astro:env/server';

// O portal só lê conteúdo publicado: usa a chave publicável e nunca guarda sessão.
// Um cliente por isolate basta (não há estado de usuário).
let cliente: SupabaseClient | undefined;

export function supabase(): SupabaseClient {
  cliente ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cliente;
}

/** URL pública de um arquivo do bucket `midias` (D-15: cache longo na borda). */
export function urlMidia(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/midias/${storagePath.split('/').map(encodeURIComponent).join('/')}`;
}
