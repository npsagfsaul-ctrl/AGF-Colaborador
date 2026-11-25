/**
 * Quando cada compromisso da agenda do DP cai, e o que está atrasado.
 *
 * Veio da agenda dos setores do Portal, com a regra do DP: o setor trabalha
 * de segunda a sexta e não trabalha em feriado nacional. Tudo é função pura
 * sobre texto "aaaa-mm-dd", sem fuso para dar errado.
 */
import { diaDaSemana, ehDiaUtil } from './feriados';
import { enesimoDiaUtilSalario } from './pagamentos';

/** DIA_UTIL: o enésimo dia útil do mês (diaMes = n), contado como para salário. */
export type Frequencia = 'DIAS_UTEIS' | 'SEMANAL' | 'MENSAL' | 'MENSAL_SEMANA' | 'UNICA' | 'DIA_UTIL';

export interface ItemAgendaCalc {
  id: string;
  frequencia: Frequencia;
  /** 0=dom … 6=sáb. SEMANAL e MENSAL_SEMANA. */
  diaSemana?: number | null;
  /** 1–31. Só MENSAL. */
  diaMes?: number | null;
  /** 1–4, ou -1 = último. Só MENSAL_SEMANA. */
  semanaDoMes?: number | null;
  /** aaaa-mm-dd. Só UNICA. */
  dataUnica?: string | null;
  /** A cada quantos meses repete (divisor de 12). 12 = anual. */
  intervaloMeses: number;
  /** 1–12: o mês de onde o intervalo conta. */
  mesBase?: number | null;
  ativo?: boolean;
  /**
   * Desde quando o item existe. Ocorrência anterior não conta: cadastrar
   * "toda segunda" hoje não pode cobrar as segundas do ano passado.
   */
  criadoEm?: string | null;
}

/** Só divisores de 12, para o ciclo fechar dentro do ano e não escorregar. */
export const INTERVALOS_MESES = [1, 2, 3, 4, 6, 12] as const;

export const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function diasNoMes(mes: number, ano: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function iso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function mesEstaNoCiclo(item: ItemAgendaCalc, mes: number): boolean {
  const intervalo = Math.max(1, item.intervaloMeses || 1);
  if (intervalo === 1) return true;
  const base = item.mesBase ?? 1;
  return (((mes - base) % intervalo) + intervalo) % intervalo === 0;
}

/**
 * Prazo que cai em dia sem expediente é ANTECIPADO para o dia útil anterior.
 *
 * É a regra dos prazos do DP (FGTS, eSocial, DCTFWeb): vencimento em fim de
 * semana ou feriado se paga antes. Se o dia útil anterior já for do mês
 * passado (prazo no dia 1º, num sábado), vai para o próximo dia útil, para a
 * ocorrência não sumir da grade do mês.
 */
function ajustarParaDiaUtil(ano: number, mes: number, dia: number): string | null {
  const total = diasNoMes(mes, ano);
  for (let d = dia; d >= 1; d--) {
    const data = iso(ano, mes, d);
    if (ehDiaUtil(data)) return data;
  }
  for (let d = dia + 1; d <= total; d++) {
    const data = iso(ano, mes, d);
    if (ehDiaUtil(data)) return data;
  }
  return null;
}

/** As datas em que este item é devido no mês pedido. */
export function ocorrenciasNoMes(item: ItemAgendaCalc, mes: number, ano: number): string[] {
  if (item.ativo === false) return [];
  const total = diasNoMes(mes, ano);
  const valeDesde = (data: string) => !item.criadoEm || data >= item.criadoEm;

  // Data escolhida de propósito: aparece mesmo se for anterior ao cadastro.
  if (item.frequencia === 'UNICA') {
    if (!item.dataUnica) return [];
    const [a, m] = item.dataUnica.split('-').map(Number);
    return a === ano && m === mes ? [item.dataUnica] : [];
  }

  if (item.frequencia === 'DIAS_UTEIS') {
    const datas: string[] = [];
    for (let d = 1; d <= total; d++) {
      const data = iso(ano, mes, d);
      if (ehDiaUtil(data) && valeDesde(data)) datas.push(data);
    }
    return datas;
  }

  if (item.frequencia === 'SEMANAL') {
    if (item.diaSemana == null) return [];
    const datas = new Set<string>();
    for (let d = 1; d <= total; d++) {
      if (diaDaSemana(iso(ano, mes, d)) !== item.diaSemana) continue;
      const data = ajustarParaDiaUtil(ano, mes, d);
      if (data && valeDesde(data)) datas.add(data);
    }
    return [...datas];
  }

  if (item.frequencia === 'MENSAL_SEMANA') {
    if (item.diaSemana == null || item.semanaDoMes == null || !mesEstaNoCiclo(item, mes)) return [];
    const candidatos: number[] = [];
    for (let d = 1; d <= total; d++) if (diaDaSemana(iso(ano, mes, d)) === item.diaSemana) candidatos.push(d);
    const i = item.semanaDoMes === -1 ? candidatos.length - 1 : item.semanaDoMes - 1;
    if (i < 0 || i >= candidatos.length) return [];
    const data = ajustarParaDiaUtil(ano, mes, candidatos[i]);
    return data && valeDesde(data) ? [data] : [];
  }

  if (item.frequencia === 'DIA_UTIL') {
    if (!mesEstaNoCiclo(item, mes)) return [];
    const data = enesimoDiaUtilSalario(ano, mes, item.diaMes ?? 5).pagar;
    return valeDesde(data) ? [data] : [];
  }

  if (item.diaMes == null || !mesEstaNoCiclo(item, mes)) return [];
  // Dia 31 num mês de 30 cai no dia 30.
  const data = ajustarParaDiaUtil(ano, mes, Math.min(item.diaMes, total));
  return data && valeDesde(data) ? [data] : [];
}

export function diferencaEmDias(a: string, b: string): number {
  const [aa, am, ad] = a.split('-').map(Number);
  const [ba, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ba, bm - 1, bd) - Date.UTC(aa, am - 1, ad)) / 86_400_000);
}

export interface AtrasoAgrupado {
  itemId: string;
  desde: string;
  quantidade: number;
  datas: string[];
  diasDeAtraso: number;
}

/**
 * O que venceu e ninguém marcou, agrupado por item: um mensal esquecido por
 * três meses é UMA pendência, não três linhas. O que vence hoje não conta.
 */
export function atrasos(itens: ItemAgendaCalc[], feitos: Set<string>, hoje: string, meses = 12): AtrasoAgrupado[] {
  const [anoHoje, mesHoje] = hoje.split('-').map(Number);
  const porItem = new Map<string, string[]>();
  for (let voltar = meses; voltar >= 0; voltar--) {
    const bruto = mesHoje - voltar;
    const ano = anoHoje + Math.floor((bruto - 1) / 12);
    const mes = ((bruto - 1 + 1200) % 12) + 1;
    for (const item of itens) {
      for (const data of ocorrenciasNoMes(item, mes, ano)) {
        if (data >= hoje || feitos.has(`${item.id}|${data}`)) continue;
        porItem.set(item.id, [...(porItem.get(item.id) ?? []), data]);
      }
    }
  }
  return [...porItem.entries()]
    .map(([itemId, datas]) => {
      const ordenadas = datas.sort();
      return { itemId, desde: ordenadas[0], quantidade: ordenadas.length, datas: ordenadas, diasDeAtraso: diferencaEmDias(ordenadas[0], hoje) };
    })
    .sort((a, b) => a.desde.localeCompare(b.desde));
}

const NOMES_DIA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const ORD_F: Record<number, string> = { 1: '1ª', 2: '2ª', 3: '3ª', 4: '4ª', [-1]: 'última' };

export function textoSemanal(diaSemana: number): string {
  return `Toda ${NOMES_DIA[diaSemana]}`;
}

export function textoMensalSemana(diaSemana: number, semana: number): string {
  return `Na ${ORD_F[semana] ?? '1ª'} ${NOMES_DIA[diaSemana]} de cada mês`;
}

/** Onde uma data cai no mês: o que o cadastro precisa para oferecer as repetições. */
export function posicaoNoMes(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number);
  return {
    ano, mes, dia,
    diaSemana: diaDaSemana(data),
    ordem: Math.ceil(dia / 7),
    ehUltima: dia + 7 > diasNoMes(mes, ano),
  };
}

export function rotuloFrequencia(item: ItemAgendaCalc): string {
  if (item.frequencia === 'UNICA') {
    if (!item.dataUnica) return 'Uma vez só';
    const [a, m, d] = item.dataUnica.split('-');
    return `Uma vez só, em ${d}/${m}/${a}`;
  }
  if (item.frequencia === 'DIAS_UTEIS') return 'Todo dia útil';
  if (item.frequencia === 'SEMANAL') return item.diaSemana == null ? 'Semanal' : textoSemanal(item.diaSemana);
  if (item.frequencia === 'DIA_UTIL') return `${item.diaMes ?? 5}º dia útil de todo mês`;

  const intervalo = Math.max(1, item.intervaloMeses || 1);
  if (item.frequencia === 'MENSAL_SEMANA') {
    if (item.diaSemana == null || item.semanaDoMes == null) return 'Uma vez por mês';
    const base = textoMensalSemana(item.diaSemana, item.semanaDoMes);
    return intervalo === 1 ? base : `${base}, a cada ${intervalo} meses`;
  }
  const dia = item.diaMes ?? 1;
  if (intervalo === 1) return `Dia ${dia} de todo mês`;
  if (intervalo === 12) return `Dia ${dia} de ${NOMES_MES[(item.mesBase ?? 1) - 1].toLowerCase()}, todo ano`;
  const base = item.mesBase ?? 1;
  const meses: string[] = [];
  for (let m = 1; m <= 12; m++) if ((((m - base) % intervalo) + intervalo) % intervalo === 0) meses.push(NOMES_MES[m - 1].slice(0, 3).toLowerCase());
  return `Dia ${dia}, a cada ${intervalo} meses (${meses.join(', ')})`;
}
