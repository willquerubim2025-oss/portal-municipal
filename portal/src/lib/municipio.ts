import { supabase } from './supabase';

/** Identidade visual (municipios.tema). Tudo opcional: o portal tem padrões neutros. */
export interface Tema {
  cor_primaria?: string;      // cabeçalho, links, botões
  cor_secundaria?: string;    // destaques, barra do rodapé
  brasao_path?: string;       // caminho no bucket midias
  logo_path?: string;
}

/** Dados institucionais e chaves de comportamento (municipios.config). */
export interface Config {
  nome_curto?: string;                 // "Jeriquara" (padrão: nome sem "Prefeitura Municipal de")
  slogan?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
  horario?: string;
  cnpj?: string;
  redes?: Record<string, string>;      // { facebook: url, instagram: url, youtube: url, ... }
  modulos?: Partial<Record<Modulo, boolean>>;
  legislacao_categorias?: string[];    // slugs das categorias de documento listadas em /legislacao
  seo?: { google_site_verification?: string; imagem_compartilhamento_path?: string };
  radar_transparencia?: boolean;      // botão do Radar da Transparência no rodapé (PNTP 2.9); padrão: mostra
}

export type Modulo =
  | 'estrutura_organizacional' | 'perguntas_frequentes' | 'agenda' | 'galeria'
  | 'destaques' | 'legislacao' | 'carta_servicos';

export interface Municipio {
  id: string;
  slug: string;
  nome: string;
  uf: string;
  cnpj: string | null;
  tema: Tema;
  config: Config;
}

export interface Contexto {
  municipio: Municipio;
  /** Domínio pelo qual o site foi acessado. */
  dominio: string;
  /** Domínio oficial do município neste ambiente (canônico, D-15). */
  dominioPrincipal: string;
  homologacao: boolean;
}

// Cache por isolate: o domínio de um município quase nunca muda, e isso evita
// uma consulta ao banco a cada requisição.
const TTL_MS = 60_000;
const cache = new Map<string, { em: number; valor: Contexto | null }>();

export async function resolverMunicipio(dominio: string): Promise<Contexto | null> {
  dominio = dominio.toLowerCase().replace(/:\d+$/, '');
  const guardado = cache.get(dominio);
  if (guardado && Date.now() - guardado.em < TTL_MS) return guardado.valor;

  const { data, error } = await supabase()
    .from('municipio_dominios')
    .select('dominio, ambiente, principal, municipio:municipios!inner(id, slug, nome, uf, cnpj, tema, config, ativo)')
    .eq('dominio', dominio)
    .maybeSingle();
  if (error) throw error;

  let valor: Contexto | null = null;
  const m = data?.municipio as unknown as (Municipio & { ativo: boolean }) | undefined;
  if (data && m?.ativo) {
    const { data: irmaos } = await supabase()
      .from('municipio_dominios')
      .select('dominio')
      .eq('municipio_id', m.id)
      .eq('ambiente', data.ambiente)
      .eq('principal', true)
      .maybeSingle();
    valor = {
      municipio: { id: m.id, slug: m.slug, nome: m.nome, uf: m.uf, cnpj: m.cnpj, tema: m.tema ?? {}, config: m.config ?? {} },
      dominio,
      dominioPrincipal: irmaos?.dominio ?? dominio,
      homologacao: data.ambiente === 'homologacao',
    };
  }
  cache.set(dominio, { em: Date.now(), valor });
  return valor;
}

/** Módulo ligado? Ausente em config.modulos = ligado (o provisionamento liga todos). */
export function moduloAtivo(m: Municipio, modulo: Modulo): boolean {
  return m.config.modulos?.[modulo] !== false;
}

/** "Prefeitura Municipal de Jeriquara" → "Jeriquara". */
export function nomeCurto(m: Municipio): string {
  return m.config.nome_curto ?? m.nome.replace(/^Prefeitura( Municipal)? d[eoa]s? /i, '');
}
