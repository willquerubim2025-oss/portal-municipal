/** "Campanha de Vacinação 2026!" → "campanha-de-vacinacao-2026" (mesmo padrão do CHECK no banco). */
export function slugificar(texto: string): string {
  return texto
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export const SLUG_VALIDO = /^[a-z0-9-]+$/;

export function dataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** ISO → valor de <input type="datetime-local"> no fuso do navegador. */
export function paraInputDataHora(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Valor de <input type="datetime-local"> → ISO (ou null se vazio). */
export function deInputDataHora(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}
