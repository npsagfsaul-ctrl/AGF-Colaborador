'use server';

import { prisma } from '@/lib/prisma';
import { executar, type Resultado } from '@/lib/acao';
import { hojeISO } from '@/lib/datas';

function competenciaValida(c: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(c);
}

/** Marca (ou desmarca) a entrega do holerite de uma competência. */
export async function marcarHolerite(
  colaboradorId: string,
  competencia: string,
  entregue: boolean,
): Promise<Resultado> {
  return executar(async () => {
    if (!competenciaValida(competencia)) throw new Error('Mês inválido.');
    const entregueEm = entregue ? hojeISO() : null;
    await prisma.holerite.upsert({
      where: { colaboradorId_competencia: { colaboradorId, competencia } },
      create: { colaboradorId, competencia, entregueEm },
      update: { entregueEm },
    });
  });
}

/** Marca de uma vez todos os que ainda faltam. */
export async function marcarTodosHolerites(competencia: string, ids: string[]): Promise<Resultado> {
  return executar(async () => {
    if (!competenciaValida(competencia)) throw new Error('Mês inválido.');
    const entregueEm = hojeISO();
    await prisma.$transaction(
      ids.map((colaboradorId) =>
        prisma.holerite.upsert({
          where: { colaboradorId_competencia: { colaboradorId, competencia } },
          create: { colaboradorId, competencia, entregueEm },
          update: { entregueEm },
        }),
      ),
    );
    return { quantidade: ids.length };
  });
}
