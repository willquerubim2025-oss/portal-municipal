// Formatação em português. Fuso: America/Sao_Paulo por padrão; municípios em outro
// fuso (AM, MT, AC...) terão config.fuso_horario (pendência, doc 08).
const FUSO = 'America/Sao_Paulo';

export function data(iso: string | null | undefined, fuso = FUSO): string {
  if (!iso) return '';
  // Datas puras (AAAA-MM-DD) não têm fuso: evita "voltar um dia".
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return d.toLocaleDateString('pt-BR', { timeZone: /^\d{4}-\d{2}-\d{2}$/.test(iso) ? 'UTC' : fuso });
}

export function dataExtenso(iso: string | null | undefined, fuso = FUSO): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: fuso });
}

export function hora(iso: string | null | undefined, fuso = FUSO): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: fuso });
}

export function diaMes(iso: string, fuso = FUSO): { dia: string; mes: string } {
  const d = new Date(iso);
  return {
    dia: d.toLocaleDateString('pt-BR', { day: '2-digit', timeZone: fuso }),
    mes: d.toLocaleDateString('pt-BR', { month: 'short', timeZone: fuso }).replace('.', ''),
  };
}

export function tamanhoArquivo(bytes: number | null | undefined): string {
  if (!bytes) return '';
  const unidades = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = bytes;
  while (v >= 1024 && i < unidades.length - 1) { v /= 1024; i++; }
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: i ? 1 : 0 })} ${unidades[i]}`;
}

/** Texto puro a partir de HTML, para meta description. */
export function resumir(texto: string | null | undefined, max = 160): string {
  const limpo = (texto ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  if (limpo.length <= max) return limpo;
  return limpo.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

export const SITUACAO: Record<string, string> = {
  vigente: 'Vigente', alterado: 'Alterado', revogado: 'Revogado', suspenso: 'Suspenso', sem_efeito: 'Sem efeito',
};

export const RELACAO: Record<string, [string, string]> = {
  // [voz ativa, voz passiva]
  altera: ['Altera', 'Alterado por'],
  revoga: ['Revoga', 'Revogado por'],
  revoga_parcialmente: ['Revoga parcialmente', 'Revogado parcialmente por'],
  regulamenta: ['Regulamenta', 'Regulamentado por'],
  retifica: ['Retifica', 'Retificado por'],
  republica: ['Republica', 'Republicado por'],
  prorroga: ['Prorroga', 'Prorrogado por'],
  referencia: ['Faz referência a', 'Referenciado por'],
};

export function paramInt(v: string | null, padrao = 1): number {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : padrao;
}
