import { diaDaSemana, feriadoEm } from './feriados';
import { lerJornada, minutosDoBloco } from './jornada';

/**
 * Estagiário não recebe VA nem VT pela agência: já recebe pelo contrato com a
 * instituição de ensino. Reconhecido pelo cargo, setor ou observação da
 * jornada ("Estagiário", "estagiária").
 */
export function ehEstagiario(c: { cargo?: string | null; setor?: string | null; jornada?: string | null }): boolean {
  return [c.cargo, c.setor, c.jornada].some(
    (t) => !!t && /estagi/i.test(t.normalize('NFD').replace(/[\u0300-\u036f]/g, '')),
  );
}

type Pessoa = { cargo?: string | null; setor?: string | null; jornada?: string | null; observacao?: string | null };

/** Freela cadastrado como colaborador ("Freelance" no cargo, setor ou observação). */
export function ehFreela(c: Pessoa): boolean {
  return [c.cargo, c.setor, c.jornada, c.observacao].some((t) => !!t && /freela/i.test(t));
}

/** Quem fica de fora do VA e do VT: estagiário e freela. */
export function foraDoBeneficio(c: Pessoa): boolean {
  return ehEstagiario(c) || ehFreela(c);
}

export const NOME_BENEFICIO = { va: 'Vale Alimentação', vt: 'Vale Transporte' } as const;
export type TipoBeneficio = keyof typeof NOME_BENEFICIO;

/**
 * Os dias de trabalho do mês, separados: segunda a sexta e sábados, ambos
 * fora feriado nacional. Ponto facultativo (Carnaval, Corpus Christi) conta
 * como dia trabalhado, igual no Calendário.
 */
export function diasDoMes(comp: string): { semana: number; sabados: number } {
  const [a, m] = comp.split('-').map(Number);
  const total = new Date(Date.UTC(a, m, 0)).getUTCDate();
  let semana = 0;
  let sabados = 0;
  for (let d = 1; d <= total; d++) {
    const data = `${comp}-${String(d).padStart(2, '0')}`;
    const s = diaDaSemana(data);
    if (s === 0) continue;
    const f = feriadoEm(data);
    if (f && !f.facultativo) continue;
    if (s === 6) sabados++;
    else semana++;
  }
  return { semana, sabados };
}

/**
 * Em que dias a pessoa trabalha, pela jornada da tela Horários. Sem jornada
 * preenchida, vale o normal: segunda a sexta.
 */
export function diasQueTrabalha(jornadaDetalhe: unknown): { semana: boolean; sabado: boolean } {
  const j = lerJornada(jornadaDetalhe);
  const semana = j ? minutosDoBloco(j.semana) > 0 : false;
  const sabado = j ? minutosDoBloco(j.sabado) > 0 : false;
  if (!semana && !sabado) return { semana: true, sabado: false };
  return { semana, sabado };
}

/**
 * Os dias da pessoa no mês quando ninguém mexeu na linha dela.
 * `diasUteis` é o de segunda a sexta (o do topo da tela, que pode ter sido
 * corrigido à mão); os sábados entram só para quem trabalha sábado.
 */
export function diasPadrao(
  quando: { semana: boolean; sabado: boolean },
  diasUteis: number,
  sabados: number,
): number {
  return (quando.semana ? diasUteis : 0) + (quando.sabado ? sabados : 0);
}

/** VA: cada sábado trabalhado vale meio dia, como na planilha do DP. */
export const SABADO_VA = 0.5;
/** VA: parte descontada em folha. */
export const DESCONTO_FOLHA_VA = 0.2;

/**
 * Dias de VA no mês: os dias úteis (seg a sex, sem feriado) + meio dia por
 * sábado trabalhado − os dias a descontar (falta, atestado, declaração).
 *
 * O campo `dias` antigo (da tela de antes) não entra: ele não aparece mais na
 * tela do VA, e um número escondido mudando a conta só confunde. Mês já
 * carregado não é afetado, porque guarda o valor pago.
 */
export function diasVA(
  diasUteis: number,
  r?: { sabados: number | null; descontar: number | null } | null,
): number {
  return Math.max(0, diasUteis + (r?.sabados ?? 0) * SABADO_VA - (r?.descontar ?? 0));
}

export function descontoFolhaVA(valorCentavos: number): number {
  return Math.round(valorCentavos * DESCONTO_FOLHA_VA);
}

/** 20.5 → "20,5". */
export function formatarDias(n: number): string {
  return String(n).replace('.', ',');
}

/**
 * Quanto carregar no mês.
 *
 * Por dia: valor × vezes por dia × dias (VT de ida e volta = 2 passagens).
 * Por mês: o valor cheio, proporcional quando há desconto
 * (20 de 22 dias = 20/22 do valor).
 */
export function valorDaRecarga(
  b: { valorCentavos: number; porDia: boolean; vezesPorDia?: number },
  dias: number,
  padrao: number,
): number {
  if (b.porDia) return Math.round(b.valorCentavos * (b.vezesPorDia ?? 1) * dias);
  if (padrao <= 0 || dias >= padrao) return b.valorCentavos;
  return Math.round((b.valorCentavos * dias) / padrao);
}

/** "R$ 4,40 × 2/dia", "R$ 8,80/dia", "R$ 300,00/mês" — o valor como foi cadastrado. */
export function rotuloValor(b: { porDia: boolean; vezesPorDia?: number }, valor: string): string {
  if (!b.porDia) return `${valor}/mês`;
  const vezes = b.vezesPorDia ?? 1;
  return vezes > 1 ? `${valor} × ${vezes}/dia` : `${valor}/dia`;
}

/**
 * Campo de valor que quer dizer "não recebe": vazio, "-", "não", "não recebe".
 * Quem escreve a frase em vez de apagar o número não deve levar erro.
 */
export function semValor(texto: string): boolean {
  const t = texto.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return t === '' || t === '-' || t.startsWith('nao');
}
