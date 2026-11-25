'use server';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { executar, type Resultado } from '@/lib/acao';
import { competenciaValida, hojeISO } from '@/lib/datas';
import { parseDinheiro } from '@/lib/dinheiro';
import { consultasDaFamilia, contaDaFamilia } from '@/lib/plano';

function centavosDe(valor: string, nome: string): number | null {
  const t = valor.trim();
  if (t === '') return null;
  const c = parseDinheiro(t);
  if (c === null) throw new Error(`Consultas de ${nome} mal escritas. Use, por exemplo, 245,44.`);
  return c || null;
}

/**
 * Consultas e exames da família na fatura do mês (do titular e de cada
 * dependente, pelo id da vida), e a descrição.
 */
export async function salvarConsultasPlano(
  competencia: string,
  colaboradorId: string,
  consultas: { titular: string; dependentes: Record<string, string> },
  observacao: string,
): Promise<Resultado> {
  return executar(async () => {
    if (!competenciaValida(competencia)) throw new Error('Mês inválido.');
    const deps = await prisma.planoVida.findMany({
      where: { colaboradorId, id: { in: Object.keys(consultas.dependentes) } },
      select: { id: true, nome: true },
    });
    const porDep: Record<string, number> = {};
    for (const d of deps) {
      const c = centavosDe(consultas.dependentes[d.id] ?? '', d.nome ?? 'dependente');
      if (c) porDep[d.id] = c;
    }
    const dados = {
      consultasCentavos: centavosDe(consultas.titular, 'titular'),
      consultasDependentes: Object.keys(porDep).length ? porDep : Prisma.DbNull,
      observacao: observacao.trim() || null,
    };
    await prisma.planoMes.upsert({
      where: { colaboradorId_competencia: { colaboradorId, competencia } },
      create: { colaboradorId, competencia, ...dados },
      update: dados,
    });
  });
}

/**
 * Marca como lançado na folha e guarda os valores daquela hora: se a
 * mensalidade tiver reajuste depois, o mês continua mostrando o que foi pago.
 */
export async function marcarPlanoLancado(competencia: string, colaboradorIds: string[], lancado: boolean): Promise<Resultado> {
  return executar(async () => {
    if (!competenciaValida(competencia)) throw new Error('Mês inválido.');
    const [vidas, meses] = await Promise.all([
      prisma.planoVida.findMany({ where: { colaboradorId: { in: colaboradorIds } }, include: { colaborador: { select: { nome: true } } } }),
      prisma.planoMes.findMany({ where: { competencia, colaboradorId: { in: colaboradorIds } } }),
    ]);
    const hoje = hojeISO();
    await prisma.$transaction(
      colaboradorIds.map((colaboradorId) => {
        const m = meses.find((x) => x.colaboradorId === colaboradorId);
        const conta = contaDaFamilia(
          vidas.filter((v) => v.colaboradorId === colaboradorId).map((v) => ({ ...v, nome: v.nome ?? v.colaborador.nome })),
          competencia,
          consultasDaFamilia(m, vidas.filter((v) => v.colaboradorId === colaboradorId), competencia),
        );
        const dados = lancado
          ? { lancadoEm: hoje, empresaCentavos: conta.empresa, colaboradorCentavos: conta.colaborador }
          : { lancadoEm: null, empresaCentavos: null, colaboradorCentavos: null };
        return prisma.planoMes.upsert({
          where: { colaboradorId_competencia: { colaboradorId, competencia } },
          create: { colaboradorId, competencia, ...dados },
          update: dados,
        });
      }),
    );
  });
}
