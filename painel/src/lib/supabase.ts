import { createClient } from '@supabase/supabase-js';

// Cliente do painel: sessão do usuário persistida no navegador. Todo acesso
// passa pelo RLS com o papel do usuário (D-09, D-11, D-13).
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

/** URL pública de um arquivo do bucket `midias`. */
export function urlMidia(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  return supabase.storage.from('midias').getPublicUrl(storagePath).data.publicUrl;
}

/** Mensagem legível para erros do Supabase/PostgREST. */
export function mensagemErro(e: unknown): string {
  const err = e as { code?: string; message?: string } | null;
  if (!err) return 'Erro desconhecido.';
  if (err.code === '42501' || /row-level security|permission denied/i.test(err.message ?? '')) {
    return 'Você não tem permissão para esta ação.';
  }
  if (err.code === '23505') return 'Já existe um registro com este endereço (slug). Escolha outro.';
  if (err.code === '23503') return 'Este registro está em uso por outro conteúdo e não pode ser alterado assim.';
  if (err.code === '23514') return 'Os dados não atendem a uma regra do sistema (ex.: data final antes da inicial, banner sem imagem). Revise e tente de novo.';
  return err.message ?? 'Erro desconhecido.';
}
