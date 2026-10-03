// @ts-check
import { defineConfig, envField } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// Portal público multi-prefeitura (D-01, D-10): SSR, o município é resolvido pelo domínio.
export default defineConfig({
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  // URLs sem barra final (D-15). 'ignore' para o Astro não responder 404 antes do
  // middleware, que redireciona "/x/" → "/x" com 301.
  trailingSlash: 'ignore',
  // Só no `astro dev`: permite simular o acesso por domínios de prefeitura (Host: x.gov.br)
  // e de teste (.teste) para validar canônico/homologação. Não afeta a produção.
  vite: {
    server: { allowedHosts: ['.gov.br', '.teste'] },
    // Pré-otimiza as dependências do servidor na partida do `astro dev`. Sem isso o Vite
    // as descobre no meio da execução, reotimiza e o worker perde o arquivo antigo
    // ("The file does not exist at .../deps_ssr/xss.js").
    ssr: { optimizeDeps: { include: ['xss', '@supabase/supabase-js'] } },
  },
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: 'server', access: 'public' }),
      // Chave publicável (anon): segura no servidor e no navegador, o RLS só libera o que está publicado.
      SUPABASE_PUBLISHABLE_KEY: envField.string({ context: 'server', access: 'public' }),
      // Só no desenvolvimento: força o domínio usado para descobrir o município (localhost não está cadastrado).
      DOMINIO_DEV: envField.string({ context: 'server', access: 'public', optional: true }),
    },
  },
});
