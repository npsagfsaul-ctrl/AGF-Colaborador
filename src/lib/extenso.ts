const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

/** 0 a 999 por extenso ("" para 0). */
function ate999(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]);
  if (resto < 20) {
    if (resto) partes.push(UNIDADES[resto]);
  } else {
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
  }
  return partes.join(' e ');
}

/** Inteiro até 999.999.999 por extenso. */
function inteiro(n: number): string {
  if (n === 0) return 'zero';
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const grupos: string[] = [];
  if (milhoes) grupos.push(milhoes === 1 ? 'um milhão' : `${ate999(milhoes)} milhões`);
  if (milhares) grupos.push(milhares === 1 ? 'mil' : `${ate999(milhares)} mil`);
  if (resto) grupos.push(ate999(resto));
  // "mil e quinhentos", mas "mil, duzentos e trinta": o "e" só antes do último
  // grupo quando ele é redondo (centena exata) ou menor que cem.
  if (grupos.length > 1 && resto && (resto < 100 || resto % 100 === 0)) {
    const ultimo = grupos.pop()!;
    return `${grupos.join(' ')} e ${ultimo}`;
  }
  return grupos.join(' ');
}

/** 28750 → "duzentos e oitenta e sete reais e cinquenta centavos". */
export function dinheiroPorExtenso(centavos: number): string {
  const reais = Math.floor(Math.abs(centavos) / 100);
  const cents = Math.abs(centavos) % 100;
  const partes: string[] = [];
  if (reais) {
    const de = reais % 1_000_000 === 0 ? ' de' : '';
    partes.push(`${inteiro(reais)}${de} ${reais === 1 ? 'real' : 'reais'}`);
  }
  if (cents) partes.push(`${inteiro(cents)} ${cents === 1 ? 'centavo' : 'centavos'}`);
  return partes.length ? partes.join(' e ') : 'zero real';
}
