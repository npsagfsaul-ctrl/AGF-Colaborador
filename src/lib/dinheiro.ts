/**
 * Dinheiro em centavos, inteiro. R$ 8,80 = 880.
 *
 * Aceita do jeito que se digita no Brasil: "8,80", "R$ 1.234,56", "600",
 * "1.500" (mil e quinhentos). Ponto com exatamente dois números depois
 * ("8.80") é lido como decimal, que é o que a pessoa quis dizer.
 */
export function parseDinheiro(texto: string | null | undefined): number | null {
  let t = (texto ?? '').replace(/R\$/gi, '').replace(/\s/g, '');
  if (!t) return null;
  if (t.includes(',')) {
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, '');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatarDinheiro(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return '—';
  return BRL.format(centavos / 100);
}

/** Para preencher campo de formulário: 880 → "8,80". */
export function dinheiroParaCampo(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return '';
  return (centavos / 100).toFixed(2).replace('.', ',');
}
