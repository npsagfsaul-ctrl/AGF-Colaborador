import { prisma } from './prisma';
import { porNome } from './ordem';
import { contaDaFamilia, vidaNoMes } from './plano';

export interface LinhaFatura {
  colaboradorId: string;
  nome: string;
  setor: string | null;
  nomesDependentes: string[];
  titular: number;
  dependentes: number;
  consultas: number;
  empresa: number;
  colaborador: number;
  observacao: string;
  lancadoEm: string | null;
}

/**
 * A fatura do plano no mês, uma linha por titular com vida no plano naquele
 * mês. Já lançado na folha: valem os valores guardados na hora.
 */
export async function faturaDoMes(comp: string): Promise<LinhaFatura[]> {
  const gente = await prisma.colaborador.findMany({
    where: { ativo: true, foraDosProcessos: false, planoVidas: { some: {} } },
    include: { planoVidas: true, planoMeses: { where: { competencia: comp } } },
  });
  return gente
    .filter((c) => c.planoVidas.some((v) => vidaNoMes(v, comp)))
    .sort(porNome)
    .map((c) => {
      const m = c.planoMeses[0];
      const conta = contaDaFamilia(c.planoVidas.map((v) => ({ ...v, nome: v.nome ?? c.nome })), comp, m?.consultasCentavos ?? null);
      const lancado = !!m?.lancadoEm && m.empresaCentavos !== null && m.colaboradorCentavos !== null;
      return {
        colaboradorId: c.id,
        nome: c.nome,
        setor: c.setor,
        nomesDependentes: conta.nomesDependentes,
        titular: conta.titular,
        dependentes: conta.dependentes,
        consultas: conta.consultas,
        empresa: lancado ? m.empresaCentavos! : conta.empresa,
        colaborador: lancado ? m.colaboradorCentavos! : conta.colaborador,
        observacao: m?.observacao ?? '',
        lancadoEm: m?.lancadoEm ?? null,
      };
    });
}
