/**
 * A conta da fatura do plano de saúde (Hospitalar), como na planilha do DP:
 *
 * - Mensalidade do TITULAR: a empresa paga 100% (todos são representantes).
 * - Mensalidade dos DEPENDENTES: o colaborador paga.
 * - Consultas e exames (coparticipação): o colaborador paga — só se usou.
 * - Desconto em folha = dependentes + consultas e exames, lançado na folha
 *   do mês SEGUINTE ao da fatura.
 * - Total da fatura = empresa + colaboradores.
 */
export interface VidaPlano {
  parentesco: string;
  nome: string;
  valorCentavos: number | null;
  inclusao: string | null;
  exclusao: string | null;
}

/** A vida conta na fatura do mês se entrou até o fim dele e não saiu antes do começo. */
export function vidaNoMes(v: { inclusao: string | null; exclusao: string | null }, comp: string): boolean {
  const inicio = `${comp}-01`;
  const fim = `${comp}-31`;
  return (!v.inclusao || v.inclusao <= fim) && (!v.exclusao || v.exclusao >= inicio);
}

export const ehTitular = (v: { parentesco: string }) => v.parentesco.trim().toLowerCase() === 'titular';

export interface ContaFamilia {
  titular: number;
  dependentes: number;
  nomesDependentes: string[];
  consultas: number;
  /** Paga pela empresa: a mensalidade do titular. */
  empresa: number;
  /** Descontado em folha: dependentes + consultas. */
  colaborador: number;
}

export function contaDaFamilia(vidas: VidaPlano[], comp: string, consultasCentavos: number | null): ContaFamilia {
  const doMes = vidas.filter((v) => vidaNoMes(v, comp));
  const titular = doMes.filter(ehTitular).reduce((s, v) => s + (v.valorCentavos ?? 0), 0);
  const deps = doMes.filter((v) => !ehTitular(v));
  const dependentes = deps.reduce((s, v) => s + (v.valorCentavos ?? 0), 0);
  const consultas = consultasCentavos ?? 0;
  return {
    titular,
    dependentes,
    nomesDependentes: deps.map((v) => v.nome),
    consultas,
    empresa: titular,
    colaborador: dependentes + consultas,
  };
}
