/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_PORTAL_DEV?: string;
  readonly VITE_AMBIENTE?: 'homologacao' | 'producao';
}
