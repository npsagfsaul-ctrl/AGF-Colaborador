'use server';

import { prisma } from '@/lib/prisma';
import { executar, type Resultado } from '@/lib/acao';
import { parseDinheiro } from '@/lib/dinheiro';
import { competenciaValida, hojeISO } from '@/lib/datas';
import { diasDoMes, diasPadrao, diasQueTrabalha, diasVA, valorDaRecarga } from '@/lib/beneficio';

function tipoValido(t: string): asserts t is 'va' | 'vt' {
  if (t !== 'va' && t !== 'vt') throw new Error('Benefício inválido.');
}

/**
 * Quem recebe e quanto, para todo mundo de uma vez. Valor em branco = não
 * recebe. Ou grava tudo ou nada, como o fechamento de horas.
 */
export async function salvarQuemRecebe(
  tipo: string,
  linhas: { colaboradorId: string; nome: string; valor: string; porDia: boolean; vezesPorDia: number }[],
): Promise<Resultado> {
  return executar(async () => {
    tipoValido(tipo);
    const ruins = linhas.filter((l) => l.valor.trim() && parseDinheiro(l.valor) === null).map((l) => l.nome);
    if (ruins.length) throw new Error(`Valor mal escrito em: ${ruins.join(', ')}. Use, por exemplo, 8,80.`);
    const vezes = (l: { vezesPorDia: number }) =>
      Number.isInteger(l.vezesPorDia) && l.vezesPorDia >= 1 && l.vezesPorDia <= 8 ? l.vezesPorDia : 1;

    await prisma.$transaction(
      linhas.map((l) => {
        const valor = parseDinheiro(l.valor);
        const chave = { colaboradorId_tipo: { colaboradorId: l.colaboradorId, tipo } };
        return valor === null || valor === 0
          ? prisma.beneficio.deleteMany({ where: { colaboradorId: l.colaboradorId, tipo } })
          : prisma.beneficio.upsert({
              where: chave,
              create: { colaboradorId: l.colaboradorId, tipo, valorCentavos: valor, porDia: l.porDia, vezesPorDia: vezes(l) },
              update: { valorCentavos: valor, porDia: l.porDia, vezesPorDia: vezes(l) },
            });
      }),
    );
  });
}

export async function definirDiasUteis(tipo: string, competencia: string, dias: number): Promise<Resultado> {
  return executar(async () => {
    tipoValido(tipo);
    if (!competenciaValida(competencia)) throw new Error('Mês inválido.');
    if (!Number.isInteger(dias) || dias < 0 || dias > 31) throw new Error('Dias úteis entre 0 e 31.');
    if (dias === diasDoMes(competencia).semana) {
      await prisma.mesBeneficio.deleteMany({ where: { tipo, competencia } });
    } else {
      await prisma.mesBeneficio.upsert({
        where: { tipo_competencia: { tipo, competencia } },
        create: { tipo, competencia, diasUteis: dias },
        update: { diasUteis: dias },
      });
    }
  });
}

/** Dias e motivo de um colaborador no mês. `dias` null = os dias normais dele no mês. */
export async function salvarDiasRecarga(
  tipo: string,
  competencia: string,
  colaboradorId: string,
  dias: number | null,
  motivo: string,
): Promise<Resultado> {
  return executar(async () => {
    tipoValido(tipo);
    if (!competenciaValida(competencia)) throw new Error('Mês inválido.');
    if (dias !== null && (!Number.isInteger(dias) || dias < 0 || dias > 31)) {
      throw new Error('Dias entre 0 e 31.');
    }
    const dados = { dias, motivo: motivo.trim() || null };
    await prisma.recargaBeneficio.upsert({
      where: { colaboradorId_tipo_competencia: { colaboradorId, tipo, competencia } },
      create: { colaboradorId, tipo, competencia, ...dados },
      update: dados,
    });
  });
}

/**
 * VA de um colaborador no mês: sábados trabalhados (meio dia cada), dias a
 * descontar (falta, atestado, declaração — aceita meio dia) e a descrição.
 */
export async function salvarAjusteVA(
  competencia: string,
  colaboradorId: string,
  sabados: number | null,
  descontar: number | null,
  motivo: string,
): Promise<Resultado> {
  return executar(async () => {
    if (!competenciaValida(competencia)) throw new Error('Mês inválido.');
    if (sabados !== null && (!Number.isInteger(sabados) || sabados < 0 || sabados > 10)) {
      throw new Error('Sábados: um número inteiro, de 0 a 10.');
    }
    if (descontar !== null && (!Number.isFinite(descontar) || descontar < 0 || descontar > 31 || (descontar * 2) % 1 !== 0)) {
      throw new Error('Descontar: dias inteiros ou meio dia (ex.: 1 ou 0,5).');
    }
    const dados = { sabados: sabados || null, descontar: descontar || null, dias: null, motivo: motivo.trim() || null };
    await prisma.recargaBeneficio.upsert({
      where: { colaboradorId_tipo_competencia: { colaboradorId, tipo: 'va', competencia } },
      create: { colaboradorId, tipo: 'va', competencia, ...dados },
      update: dados,
    });
  });
}

/**
 * Marca a recarga como feita e guarda o valor daquele momento: se o valor
 * do benefício mudar depois, o histórico do mês continua mostrando o que
 * foi carregado de fato.
 */
export async function marcarRecarga(
  tipo: string,
  competencia: string,
  colaboradorIds: string[],
  carregado: boolean,
): Promise<Resultado> {
  return executar(async () => {
    tipoValido(tipo);
    if (!competenciaValida(competencia)) throw new Error('Mês inválido.');

    const [beneficios, recargas, mes] = await Promise.all([
      prisma.beneficio.findMany({
        where: { tipo, colaboradorId: { in: colaboradorIds } },
        include: { colaborador: { select: { jornadaDetalhe: true } } },
      }),
      prisma.recargaBeneficio.findMany({ where: { tipo, competencia, colaboradorId: { in: colaboradorIds } } }),
      prisma.mesBeneficio.findUnique({ where: { tipo_competencia: { tipo, competencia } } }),
    ]);
    const doMes = diasDoMes(competencia);
    const diasUteis = mes?.diasUteis ?? doMes.semana;
    const hoje = hojeISO();

    await prisma.$transaction(
      colaboradorIds.map((colaboradorId) => {
        const b = beneficios.find((x) => x.colaboradorId === colaboradorId);
        const r = recargas.find((x) => x.colaboradorId === colaboradorId);
        // VA: dias úteis + sábados trabalhados − descontos. VT: os dias da jornada dela.
        const padrao = !b ? 0 : tipo === 'va' ? diasUteis : diasPadrao(diasQueTrabalha(b.colaborador.jornadaDetalhe), diasUteis, doMes.sabados);
        const dias = tipo === 'va' ? diasVA(diasUteis, r) : (r?.dias ?? padrao);
        const valor = carregado && b ? valorDaRecarga(b, dias, padrao) : null;
        const dados = { carregadoEm: carregado ? hoje : null, valorCentavos: valor };
        return prisma.recargaBeneficio.upsert({
          where: { colaboradorId_tipo_competencia: { colaboradorId, tipo, competencia } },
          create: { colaboradorId, tipo, competencia, ...dados },
          update: dados,
        });
      }),
    );
    return { quantidade: colaboradorIds.length };
  });
}
