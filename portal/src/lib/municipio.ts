import { supabase } from './supabase';

/** Identidade visual (municipios.tema). Tudo opcional: o portal tem padrões neutros. */
export interface Tema {
  cor_primaria?: string;      // cabeçalho, links, botões
  cor_secundaria?: string;    // destaques, barra do rodapé
  brasao_path?: string;       // caminho no bucket midias
  /** Endereço absoluto do brasão, quando ainda não foi enviado ao Storage. brasao_path tem preferência. */
  brasao_url?: string;
  /** Cabeçalho claro (D-136): logotipo horizontal (já com o nome) no lugar do brasão + nome escrito. */
  logo_path?: string;
  /** Rodapé do cabeçalho claro (D-136): logotipo horizontal no lugar do brasão + nome. */
  logo_rodape_path?: string;
  /** D-136: sem ícones decorativos no cabeçalho e no rodapé (só texto). */
  sem_icones?: boolean;
  /** D-137: cabeçalho claro cerca de 25% mais baixo (mesmas fontes e logotipo), para o destaque subir na tela. */
  cabecalho_compacto?: boolean;
  /** D-136: cor do rodapé do cabeçalho claro; vazia = a do padrão. */
  cor_rodape?: string;
  // ---- Tema ampliado (D-17, D-39). Sem `layout: 'vitrine'`, nada abaixo muda o portal.
  /** 'classico' (padrão): container centralizado. 'vitrine': seções de largura total, home por blocos. */
  layout?: 'classico' | 'vitrine';
  /** Versão escura da cor secundária, para botões e links com texto branco (contraste ≥ 4,5). */
  cor_secundaria_escura?: string;
  /** Chamadas de ação (botão do destaque, faixa de aviso informativo). Texto em cor_primaria. */
  cor_acento?: string;
  /** Fundo da régua de título das seções (D-46); padrão: a cor secundária bem clara. */
  cor_regua?: string;
  /** Moldura em volta do carrossel de destaque da página inicial (D-108); vazia = sem moldura. */
  moldura_destaque?: string;
  /** Fundo dos dias com evento no calendário da página inicial (D-109); padrão: o da régua. */
  cor_calendario?: string;
  /** Fundo da página inicial atrás das seções (D-110); vazio = branco. Cards, blocos com cor própria, cabeçalho e rodapé não mudam. */
  cor_fundo_pagina?: string;
  /** Fundo da barra de acessibilidade do topo (D-111), com texto branco; vazio = cor do cabeçalho ou a principal. */
  cor_barra_acessibilidade?: string;
  /** Cabeçalho claro: cor das letras (nome, menu, lupa) sobre o fundo branco (D-114); vazio = cor principal. */
  cor_letras_cabecalho?: string;
  /** Cabeçalho do vitrine (D-54): fundo e cor do texto; padrão: cor primária com texto branco. */
  cor_cabecalho?: string;
  cor_cabecalho_texto?: string;
  /** Cabeçalho claro (D-57): cores da faixa fina sob a barra de acessibilidade, em segmentos iguais. Sem elas, não há faixa (D-71). */
  cores_faixa?: string[];
  /** Cabeçalho claro (D-57/D-58): largura máxima do bloco de cima (barra, cabeçalho, aviso, destaque), ex.: '1290px'. */
  largura_topo?: string;
  /** Cabeçalho claro (D-62): fonte só da barra de acessibilidade e do cabeçalho (uma de FONTES_DISPONIVEIS). */
  fonte_cabecalho?: string;
  /** Paleta própria dos cards de Serviços (D-52): { forte, claro } em #rrggbb; sem ela, as cores vivas. */
  cores_cards?: { nome?: string; forte: string; claro: string }[];
  /** Película sobre as fotos do destaque (D-49): 'cor' (cor primária, padrão) ou 'neutro' (escurecimento sem cor). */
  filtro_destaque?: 'cor' | 'neutro';
  /** Cores vivas das seções e dos cards: `forte` aceita texto branco; `claro` é fundo de seção. */
  cores_vivas?: { nome: string; forte: string; claro: string }[];
  /** Famílias auto-hospedadas pelo portal (FONTES_DISPONIVEIS); outra família cai na fonte do sistema. */
  fonte_titulos?: string;
  fonte_texto?: string;
  /** Layout vitrine em telas largas: margem lateral do destaque e do conteúdo das seções (ex.: '3cm', '6cm', '120px'). */
  margem_destaque?: string;
  margem_secoes?: string;
}

/** Fontes empacotadas no portal (@fontsource): sem chamada a terceiros (LGPD, D-17). */
export const FONTES_DISPONIVEIS = ['Montserrat', 'Source Sans 3', 'Prompt', 'Raleway'] as const;

/** Blocos da página inicial no layout vitrine, na ordem em que aparecem. */
export type BlocoHome = 'destaque' | 'noticias' | 'foco' | 'servicos' | 'calendario' | 'agenda' | 'equipe' | 'atalhos' | 'sistemas'
  // Blocos de seção própria (D-136): cada um tem fundo e estilo próprios, fora da alternância de fundos.
  | 'acoes' | 'numeros' | 'ranking' | 'noticias_lista' | 'golpes' | 'direitos' | 'avaliacao' | 'presencial';

/** Blocos com seção própria (D-136): o componente monta a própria <section>. */
export const BLOCOS_PROPRIOS: readonly BlocoHome[] = ['acoes', 'numeros', 'ranking', 'noticias_lista', 'golpes', 'direitos', 'avaliacao', 'presencial'];

/** Cabeçalho comum dos blocos de seção própria: linha pequena, título (trecho entre *asteriscos* em destaque) e texto. */
export interface TextosBloco { sobretitulo?: string; titulo?: string; texto?: string; nota?: string; botao?: { rotulo: string; url: string } }
/** Bloco "acoes" (D-136): cartões numerados logo abaixo do destaque. */
export interface ItemAcao { titulo: string; texto?: string; rotulo?: string; url: string }
/** Bloco "numeros" (D-136): indicadores grandes e uma barra de desfecho. `nota` aparece como etiqueta (ex.: dados ilustrativos). */
export interface BlocoNumeros { itens?: { valor: string; sufixo?: string; texto: string }[]; desfecho?: { titulo?: string; partes: { rotulo: string; pct: number }[] } }
/** Bloco "ranking" (D-136): lista ordenada com barras e caixa de consulta ao lado. */
export interface BlocoRanking { itens?: { nome: string; qtd: number; rotulo?: string }[]; consulta?: { titulo: string; texto?: string; url?: string; rotulo?: string } }
/** Bloco "golpes" (D-136): vídeos do YouTube; o vídeo só carrega depois do clique (privacidade e desempenho). */
export interface VideoGolpe { titulo: string; resumo?: string; youtube?: string; duracao?: string }
/** Bloco "direitos" (D-136): cartões com um número grande (prazo) e a lei. */
export interface ItemDireito { numero: string; unidade?: string; titulo: string; texto: string; lei?: string }
/** Bloco "avaliacao" (D-136): formulário (1 a 5) gravado em `avaliacoes`; `ilustrativo` mostra um resumo de exemplo. */
export interface BlocoAvaliacao { ilustrativo?: { media: string; total: string; dist: number[] } }
/** Bloco "presencial" (D-136): contatos (de config), mapa e uma faixa de chamada. */
export interface BlocoPresencial { mapa?: string; itens?: { rotulo: string; texto: string }[]; faixa?: { titulo: string; texto?: string; rotulo?: string; url?: string } }

/** Card do bloco "Em foco" (config.home.foco, D-44): divisão ou programa com muita procura do cidadão. */
export interface ItemFoco {
  chamada?: string;                    // linha pequena acima do título (ex.: nome da divisão)
  titulo: string;
  texto?: string;
  imagem_path?: string;                // caminho no bucket midias
  imagem_alt?: string;
  cor?: number;                        // índice em tema.cores_vivas
  botao?: { rotulo: string; url: string };
  links?: { rotulo: string; url: string }[];
}

/** Dados institucionais e chaves de comportamento (municipios.config). */
export interface Config {
  /** D-133: false esconde a faixa "Ambiente de homologação" (o portal continua fora dos buscadores). */
  faixa_homologacao?: boolean;
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
  migalhas?: boolean;                 // trilha "Início › ..." no topo das páginas internas (D-102); padrão: mostra
  /** Texto da marca no cabeçalho. Padrão: "Prefeitura de" + nome curto. */
  marca?: { linha1?: string; linha2?: string };
  /** Site do ente ao qual a organização pertence (ex.: a Prefeitura de uma secretaria): barra "Voltar ao site". */
  site_prefeitura?: string;
  /** Layout vitrine: blocos da página inicial e textos das seções. */
  /** Cabeçalho do layout vitrine em carrossel (D-47): ligado por padrão; tempos em segundos.
   *  estilo 'claro' (D-57; padrão do vitrine desde D-76): barra de acessibilidade na cor do cabeçalho, cabeçalho branco com
   *  marca, menu, lupa e um botão de ação (`botao`), e destaque mais baixo com setas. 'carrossel' volta ao cabeçalho de D-47. */
  cabecalho?: { carrossel?: boolean; intervalo_s?: number; transicao_s?: number; estilo?: 'carrossel' | 'claro'; botao?: { rotulo: string; url: string };
    /** D-136: botões só de texto no cabeçalho claro (substituem `botao`); 'cheio' usa a cor de acento, 'contorno' só a borda. */
    botoes?: { rotulo: string; url: string; estilo?: 'cheio' | 'contorno' }[] };
  /** D-136: faixa fina no topo de todas as páginas (ex.: "Proposta de demonstração"). */
  faixa_topo?: string;
  home?: { blocos?: BlocoHome[]; titulos?: Partial<Record<BlocoHome, string>>; foco?: ItemFoco[]; fundo_cinza?: BlocoHome[];
    /** Quantos cards na fileira de cima das Notícias (D-59): 1 a 5, padrão 5. */
    noticias_fileira?: number;
    /** Blocos de seção própria (D-136). */
    textos?: Partial<Record<BlocoHome, TextosBloco>>;
    acoes?: ItemAcao[]; numeros?: BlocoNumeros; ranking?: BlocoRanking; golpes?: VideoGolpe[];
    direitos?: ItemDireito[]; avaliacao?: BlocoAvaliacao; presencial?: BlocoPresencial;
    /** D-147: cor de fundo alternativa de blocos de seção própria (hoje: golpes e numeros), para variar o visual entre organizações. */
    cores?: Partial<Record<BlocoHome, 'azul' | 'verde'>> };
}

export type Modulo =
  | 'estrutura_organizacional' | 'perguntas_frequentes' | 'agenda' | 'galeria'
  | 'destaques' | 'legislacao' | 'carta_servicos' | 'equipe_gestora' | 'vlibras';

export interface Municipio {
  id: string;
  slug: string;
  nome: string;
  uf: string;
  cnpj: string | null;
  /** Tipo de organização (0017): orienta textos e o pacote padrão (D-90). */
  tipo_ente: 'prefeitura' | 'secretaria' | 'camara' | 'autarquia' | string;
  cidade: string | null;
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
    .select('dominio, ambiente, principal, municipio:municipios!inner(id, slug, nome, uf, cnpj, tipo_ente, cidade, tema, config, ativo)')
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
      municipio: { id: m.id, slug: m.slug, nome: m.nome, uf: m.uf, cnpj: m.cnpj, tipo_ente: m.tipo_ente ?? 'prefeitura', cidade: m.cidade ?? null, tema: m.tema ?? {}, config: m.config ?? {} },
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

/** Organização que não é a prefeitura inteira (secretaria, câmara...): textos sem "municipal" (D-90). */
export const ehPrefeitura = (m: Municipio) => (m.tipo_ente ?? 'prefeitura') === 'prefeitura';
