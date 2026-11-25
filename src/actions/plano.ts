'use server';

import { prisma } from '@/lib/prisma';
import { executar, type Resultado } from '@/lib/acao';
import { competenciaValida, hojeISO } from '@/lib/datas';
import { parseDinheiro } from '@/lib/dinheiro';
import { contaDaFamilia } from '@/lib/plano';

/** Consultas e exames de um titular na fatura do mês, e a descrição. */
export async function salvarConsultasPlano(
  competencia: string,
  colaboradorId: string,
  valor: string,
  observacao: string,
): Promise<Resultado> {
  return executar(async () => {
    if (!competenciaValida(competencia)) throw new Error('Mês inválido.');
    const t = valor.trim();
    const centavos = t === '' ? null : parseDinheiro(t);
    if (t !== '' && centavos === null) throw new Error('Valor das consultas mal escrito. Use, por exemplo, 245,44.');
    const dados = { consultasCentavos: centavos || null, observacao: observacao.trim() || null };
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
          m?.consultasCentavos ?? null,
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
