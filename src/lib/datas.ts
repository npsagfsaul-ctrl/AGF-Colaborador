/**
 * Datas do Departamento Pessoal, todas como texto "aaaa-mm-dd".
 *
 * Sem DateTime e sem fuso: o servidor roda em UTC, e uma data sem hora vira o
 * dia anterior com facilidade. Toda a aritmética aqui é feita em UTC ao meio-dia
 * só para contar dias, e o resultado volta para texto.
 */

/** Hoje pelo relógio de São Paulo. */
export function hojeISO(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

function partes(iso: string): [number, number, number] {
  const [a, m, d] = iso.split('-').map(Number);
  return [a, m, d];
}

function utc(iso: string): number {
  const [a, m, d] = partes(iso);
  return Date.UTC(a, m - 1, d, 12);
}

function iso(a: number, m: number, d: number): string {
  return `${String(a).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function valida(texto: string | null | undefined): texto is string {
  if (!texto || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [a, m, d] = partes(texto);
  const t = new Date(Date.UTC(a, m - 1, d));
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function dataBR(texto: string | null | undefined): string {
  if (!valida(texto)) return '—';
  const [a, m, d] = partes(texto);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`;
}

/** Dias corridos de `a` até `b` (positivo se `b` vem depois). */
export function diasEntre(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}

export function somaDias(base: string, dias: number): string {
  const t = new Date(utc(base) + dias * 86_400_000);
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/**
 * Soma meses mantendo o dia. Quando o mês de chegada é mais curto, cai no
 * último dia dele: 31/01 + 1 mês = 28/02 (ou 29), não 03/03.
 */
export function somaMeses(base: string, meses: number): string {
  const [a, m, d] = partes(base);
  const total = (a * 12 + (m - 1)) + meses;
  const na = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(na, nm, 0)).getUTCDate();
  return iso(na, nm, Math.min(d, ultimo));
}

/* ─── Aniversário ─── */

/**
 * O próximo aniversário a partir de hoje (hoje conta). Quem nasceu em 29/02
 * comemora em 28/02 nos anos que não são bissextos.
 */
export function proximoAniversario(nascimento: string, hoje: string): { data: string; dias: number; idade: number } {
  const [an, mn, dn] = partes(nascimento);
  const [ah] = partes(hoje);
  const noAno = (a: number) => {
    const ultimo = new Date(Date.UTC(a, mn, 0)).getUTCDate();
    return iso(a, mn, Math.min(dn, ultimo));
  };
  let data = noAno(ah);
  if (data < hoje) data = noAno(ah + 1);
  const [ad] = partes(data);
  return { data, dias: diasEntre(hoje, data), idade: ad - an };
}

/* ─── ASO ─── */

export type SituacaoAso = 'sem-registro' | 'vencido' | 'vence-logo' | 'em-dia';

/** Vencimento do exame e a situação, avisando com `antecedencia` dias. */
export function situacaoAso(
  ultimo: string | null | undefined,
  meses: number,
  hoje: string,
  antecedencia = 60,
): { situacao: SituacaoAso; vencimento: string | null; dias: number | null } {
  if (!valida(ultimo)) return { situacao: 'sem-registro', vencimento: null, dias: null };
  const vencimento = somaMeses(ultimo, Math.max(1, meses));
  const dias = diasEntre(hoje, vencimento);
  const situacao: SituacaoAso = dias < 0 ? 'vencido' : dias <= antecedencia ? 'vence-logo' : 'em-dia';
  return { situacao, vencimento, dias };
}

/* ─── Férias ─── */

export interface PeriodoFerias {
  /** 1 = primeiro ano de casa. */
  numero: number;
  /** Primeiro e último dia do período aquisitivo. */
  inicio: string;
  fim: string;
  /** Até quando as férias deste período têm de ser tiradas (fim do concessivo). */
  limite: string;
  /** O período já foi completado (o direito já existe). */
  completo: boolean;
  diasTirados: number;
  diasRestantes: number;
}

export interface SituacaoFerias {
  periodos: PeriodoFerias[];
  /** O período completo mais antigo que ainda tem dias a tirar. */
  pendente: PeriodoFerias | null;
  /** Dias de férias já adquiridos e não tirados, somando todos os períodos completos. */
  diasPendentes: number;
  /** Quando o período em curso se completa. */
  proximoDireito: string | null;
}

/**
 * Períodos de férias desde a admissão, com os dias tirados abatidos do mais
 * antigo para o mais novo.
 *
 * Cada ano de casa dá 30 dias. O período aquisitivo é o ano em si; as férias
 * dele têm de ser tiradas no ano seguinte (o concessivo) — o `limite` é o
 * último dia desse ano seguinte.
 *
 * Os dias de cada registro de férias vão para o período mais antigo que ainda
 * tem saldo, inclusive férias marcadas para o futuro: quem já marcou, já
 * resolveu aquele período.
 *
 * Não trata redução por faltas nem venda de 10 dias: o cálculo oficial é da
 * contabilidade. Isto aqui é o lembrete do DP de quem precisa sair e até quando.
 */
export function situacaoFerias(
  admissao: string | null | undefined,
  ferias: { inicio: string; fim: string }[],
  hoje: string,
): SituacaoFerias | null {
  if (!valida(admissao) || admissao > hoje) return null;

  // Períodos até o que está em curso (mais um, para absorver férias antecipadas).
  const periodos: PeriodoFerias[] = [];
  for (let n = 1; ; n++) {
    const inicio = somaMeses(admissao, (n - 1) * 12);
    if (inicio > hoje && n > 1) break;
    const completaEm = somaMeses(admissao, n * 12);
    periodos.push({
      numero: n,
      inicio,
      fim: somaDias(completaEm, -1),
      limite: somaDias(somaMeses(admissao, (n + 1) * 12), -1),
      completo: completaEm <= hoje,
      diasTirados: 0,
      diasRestantes: 30,
    });
    if (n > 80) break; // proteção contra data absurda
  }

  let tirados = ferias
    .filter((f) => valida(f.inicio) && valida(f.fim) && f.fim >= f.inicio)
    .reduce((soma, f) => soma + diasEntre(f.inicio, f.fim) + 1, 0);

  for (const p of periodos) {
    const usa = Math.min(30, tirados);
    p.diasTirados = usa;
    p.diasRestantes = 30 - usa;
    tirados -= usa;
  }

  const completos = periodos.filter((p) => p.completo);
  const pendente = completos.find((p) => p.diasRestantes > 0) ?? null;
  const emCurso = periodos.find((p) => !p.completo) ?? null;

  return {
    periodos,
    pendente,
    diasPendentes: completos.reduce((s, p) => s + p.diasRestantes, 0),
    proximoDireito: emCurso ? somaDias(emCurso.fim, 1) : null,
  };
}

/* ─── Holerite ─── */

/** "2026-10" → "outubro de 2026". */
export function nomeCompetencia(comp: string): string {
  const [a, m] = comp.split('-').map(Number);
  const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
    'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${nomes[m - 1]} de ${a}`;
}

/**
 * A competência do holerite que se entrega agora: a do mês anterior. O de
 * outubro é pago e entregue em novembro.
 */
export function competenciaAtual(hoje: string): string {
  return somaMeses(hoje, -1).slice(0, 7);
}

/** As últimas `n` competências, da mais recente para a mais antiga. */
export function ultimasCompetencias(hoje: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => somaMeses(hoje, -(i + 1)).slice(0, 7));
}

/* ─── Meses ─── */

/** "2026-11" do dia de hoje. */
export function mesDe(hoje: string): string {
  return hoje.slice(0, 7);
}

/** Soma meses a uma competência "aaaa-mm". */
export function somaMes(comp: string, meses: number): string {
  return somaMeses(`${comp}-01`, meses).slice(0, 7);
}

/** Segunda a sexta do mês. Feriado não entra na conta: ajusta-se à mão. */
export function diasUteisDoMes(comp: string): number {
  const [a, m] = comp.split('-').map(Number);
  const total = new Date(Date.UTC(a, m, 0)).getUTCDate();
  let n = 0;
  for (let d = 1; d <= total; d++) {
    const s = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
    if (s !== 0 && s !== 6) n++;
  }
  return n;
}

export function competenciaValida(c: string | null | undefined): c is string {
  return !!c && /^\d{4}-(0[1-9]|1[0-2])$/.test(c);
}

/** "2026-11" → "nov/26", para listas curtas. */
export function mesCurto(comp: string): string {
  const [a, m] = comp.split('-').map(Number);
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${nomes[m - 1]}/${String(a).slice(2)}`;
}
