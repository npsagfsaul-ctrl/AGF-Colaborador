/**
 * Feriados nacionais do Brasil, calculados — não há lista para atualizar.
 *
 * Os fixos vêm da lei; Sexta-feira Santa depende da Páscoa. Carnaval e Corpus
 * Christi são pontos facultativos nacionais: aparecem no calendário, mas não
 * fecham o dia (cada empresa decide).
 */
export interface Feriado {
  data: string;
  nome: string;
  facultativo: boolean;
}

function iso(a: number, m: number, d: number) {
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function somaDias(base: string, dias: number) {
  const [a, m, d] = base.split('-').map(Number);
  const t = new Date(Date.UTC(a, m - 1, d) + dias * 86_400_000);
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(ano, mes, dia);
}

const cache = new Map<number, Feriado[]>();

export function feriadosDoAno(ano: number): Feriado[] {
  const pronto = cache.get(ano);
  if (pronto) return pronto;

  const p = pascoa(ano);
  const lista: Feriado[] = [
    { data: iso(ano, 1, 1), nome: 'Confraternização Universal', facultativo: false },
    { data: somaDias(p, -48), nome: 'Carnaval', facultativo: true },
    { data: somaDias(p, -47), nome: 'Carnaval', facultativo: true },
    { data: somaDias(p, -2), nome: 'Sexta-feira Santa', facultativo: false },
    { data: iso(ano, 4, 21), nome: 'Tiradentes', facultativo: false },
    { data: iso(ano, 5, 1), nome: 'Dia do Trabalho', facultativo: false },
    { data: somaDias(p, 60), nome: 'Corpus Christi', facultativo: true },
    { data: iso(ano, 9, 7), nome: 'Independência do Brasil', facultativo: false },
    { data: iso(ano, 10, 12), nome: 'Nossa Senhora Aparecida', facultativo: false },
    { data: iso(ano, 11, 2), nome: 'Finados', facultativo: false },
    { data: iso(ano, 11, 15), nome: 'Proclamação da República', facultativo: false },
    // Feriado nacional desde a Lei 14.759/2023.
    ...(ano >= 2024 ? [{ data: iso(ano, 11, 20), nome: 'Consciência Negra', facultativo: false }] : []),
    { data: iso(ano, 12, 25), nome: 'Natal', facultativo: false },
  ];
  lista.sort((x, y) => x.data.localeCompare(y.data));
  cache.set(ano, lista);
  return lista;
}

export function feriadoEm(data: string): Feriado | null {
  const ano = Number(data.slice(0, 4));
  return feriadosDoAno(ano).find((f) => f.data === data) ?? null;
}

export function diaDaSemana(data: string): number {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/** Dia em que o DP trabalha: segunda a sexta, fora feriado nacional. */
export function ehDiaUtil(data: string): boolean {
  const s = diaDaSemana(data);
  if (s === 0 || s === 6) return false;
  const f = feriadoEm(data);
  return !f || f.facultativo;
}
