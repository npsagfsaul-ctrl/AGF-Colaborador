export const NOME_BENEFICIO = { va: 'Vale Alimentação', vt: 'Vale Transporte' } as const;
export type TipoBeneficio = keyof typeof NOME_BENEFICIO;

/**
 * Quanto carregar no mês.
 *
 * Por dia: valor × dias. Por mês: o valor cheio, proporcional aos dias
 * quando há desconto (20 de 22 dias = 20/22 do valor).
 */
export function valorDaRecarga(
  b: { valorCentavos: number; porDia: boolean },
  dias: number,
  diasUteis: number,
): number {
  if (b.porDia) return b.valorCentavos * dias;
  if (diasUteis <= 0 || dias >= diasUteis) return b.valorCentavos;
  return Math.round((b.valorCentavos * dias) / diasUteis);
}
