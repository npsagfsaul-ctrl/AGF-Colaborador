import { prisma } from './prisma';
import { porNome } from './ordem';
import { consultasDaFamilia, consultasPorDependente, contaDaFamilia, ehTitular, vidaNoMes } from './plano';

/** Quem da família pode ter consultas no mês: o titular e cada dependente. */
export interface PessoaFatura {
  /** null = o titular (vai em consultasCentavos). */
  vidaId: string | null;
  nome: string;
  parentesco: string;
  mensalidade: number;
  consultas: number;
}

export interface LinhaFatura {
  colaboradorId: string;
  nome: string;
  setor: string | null;
  nomesDependentes: string[];
  pessoas: PessoaFatura[];
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
    include: { planoVidas: { orderBy: { createdAt: 'asc' } }, planoMeses: { where: { competencia: comp } } },
  });
  return gente
    .filter((c) => c.planoVidas.some((v) => vidaNoMes(v, comp)))
    .sort(porNome)
    .map((c) => {
      const m = c.planoMeses[0];
      const consultas = consultasDaFamilia(m, c.planoVidas, comp);
      const conta = contaDaFamilia(c.planoVidas.map((v) => ({ ...v, nome: v.nome ?? c.nome })), comp, consultas);
      const lancado = !!m?.lancadoEm && m.empresaCentavos !== null && m.colaboradorCentavos !== null;
      const porDep = consultasPorDependente(m?.consultasDependentes);
      const pessoas: PessoaFatura[] = [
        { vidaId: null, nome: c.nome, parentesco: 'Titular', mensalidade: conta.titular, consultas: m?.consultasCentavos ?? 0 },
        ...c.planoVidas
          .filter((v) => !ehTitular(v) && vidaNoMes(v, comp))
          .map((v) => ({ vidaId: v.id, nome: v.nome ?? '', parentesco: v.parentesco, mensalidade: v.valorCentavos ?? 0, consultas: porDep[v.id] ?? 0 })),
      ];
      return {
        colaboradorId: c.id,
        nome: c.nome,
        setor: c.setor,
        nomesDependentes: conta.nomesDependentes,
        pessoas,
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
