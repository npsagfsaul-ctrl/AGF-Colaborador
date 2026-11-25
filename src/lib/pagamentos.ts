/**
 * As datas de pagamento da agência e o adiantamento.
 *
 * - Adiantamento: 40% do salário, todo dia 20 (como no holerite: referência
 *   40,00). Dia 20 sem expediente → paga no dia útil anterior.
 * - Mensal (o resto, já com os descontos da folha): no 5º dia útil do mês
 *   seguinte.
 *
 * Para salário, a lei conta o SÁBADO como dia útil (só domingo e feriado
 * ficam fora). Quando o 5º dia útil cai num sábado, banco fechado: o
 * pagamento sai na sexta, para não atrasar.
 */
import { diaDaSemana, ehDiaUtil, feriadoEm } from './feriados';

export const ADIANTAMENTO = 0.4;

function iso(ano: number, mes: number, dia: number) {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Volta até um dia de expediente (seg a sex, fora feriado). */
function diaUtilAnterior(data: string): string {
  let [a, m, d] = data.split('-').map(Number);
  while (d > 1 && !ehDiaUtil(iso(a, m, d))) d--;
  return iso(a, m, d);
}

/** O enésimo dia útil do mês para salário: segunda a sábado, fora feriado. */
export function enesimoDiaUtilSalario(ano: number, mes: number, n = 5): { legal: string; pagar: string } {
  const total = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  let conta = 0;
  for (let d = 1; d <= total; d++) {
    const data = iso(ano, mes, d);
    if (diaDaSemana(data) === 0) continue;
    const f = feriadoEm(data);
    if (f && !f.facultativo) continue;
    if (++conta === n) return { legal: data, pagar: diaDaSemana(data) === 6 ? diaUtilAnterior(data) : data };
  }
  const ultimo = iso(ano, mes, total);
  return { legal: ultimo, pagar: diaUtilAnterior(ultimo) };
}

/** Dia do adiantamento no mês: dia 20, ou o dia útil antes dele. */
export function diaDoAdiantamento(ano: number, mes: number): string {
  return diaUtilAnterior(iso(ano, mes, 20));
}

export function valorAdiantamento(salarioCentavos: number): number {
  return Math.round(salarioCentavos * ADIANTAMENTO);
}
