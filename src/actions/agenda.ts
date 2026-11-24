'use server';

import { prisma } from '@/lib/prisma';
import { executar, type Resultado } from '@/lib/acao';
import { INTERVALOS_MESES, type Frequencia } from '@/lib/agenda';
import { ehDiaUtil, feriadoEm } from '@/lib/feriados';
import { valida } from '@/lib/datas';

export interface NovoItemAgenda {
  titulo: string;
  observacao?: string;
  frequencia: Frequencia;
  diaSemana?: number;
  diaMes?: number;
  semanaDoMes?: number;
  dataUnica?: string;
  intervaloMeses?: number;
  mesBase?: number;
}

export async function criarItemAgenda(d: NovoItemAgenda): Promise<Resultado> {
  return executar(async () => {
    const titulo = d.titulo?.trim();
    if (!titulo) throw new Error('Escreva o que precisa ser feito.');
    const comum = { titulo, observacao: d.observacao?.trim() || null };
    const intervalo = Number(d.intervaloMeses ?? 1);
    if (!INTERVALOS_MESES.includes(intervalo as (typeof INTERVALOS_MESES)[number])) throw new Error('Intervalo inválido.');
    const mesBase = intervalo === 1 ? null : Number(d.mesBase);
    if (mesBase !== null && (!Number.isInteger(mesBase) || mesBase < 1 || mesBase > 12)) throw new Error('Mês inválido.');

    switch (d.frequencia) {
      case 'UNICA': {
        if (!valida(d.dataUnica)) throw new Error('Escolha o dia.');
        // Dia sem expediente: o item ficaria numa célula apagada do calendário.
        if (!ehDiaUtil(d.dataUnica)) {
          const f = feriadoEm(d.dataUnica);
          throw new Error(f ? `Esse dia é feriado (${f.nome}). Escolha outro dia.` : 'Esse dia é fim de semana, quando o DP não atua. Escolha outro dia.');
        }
        await prisma.itemAgenda.create({ data: { ...comum, frequencia: 'UNICA', dataUnica: d.dataUnica } });
        return;
      }
      case 'DIAS_UTEIS':
        await prisma.itemAgenda.create({ data: { ...comum, frequencia: 'DIAS_UTEIS' } });
        return;
      case 'SEMANAL': {
        const dia = Number(d.diaSemana);
        if (!(dia >= 1 && dia <= 5)) throw new Error('Escolha um dia de segunda a sexta.');
        await prisma.itemAgenda.create({ data: { ...comum, frequencia: 'SEMANAL', diaSemana: dia } });
        return;
      }
      case 'MENSAL_SEMANA': {
        const dia = Number(d.diaSemana);
        const semana = Number(d.semanaDoMes);
        if (!(dia >= 1 && dia <= 5)) throw new Error('Escolha um dia de segunda a sexta.');
        if (![1, 2, 3, 4, -1].includes(semana)) throw new Error('Escolha qual semana do mês.');
        await prisma.itemAgenda.create({
          data: { ...comum, frequencia: 'MENSAL_SEMANA', diaSemana: dia, semanaDoMes: semana, intervaloMeses: intervalo, mesBase },
        });
        return;
      }
      case 'MENSAL': {
        const dia = Number(d.diaMes);
        if (!(dia >= 1 && dia <= 31)) throw new Error('Dia do mês inválido.');
        await prisma.itemAgenda.create({
          data: { ...comum, frequencia: 'MENSAL', diaMes: dia, intervaloMeses: intervalo, mesBase },
        });
        return;
      }
      default:
        throw new Error('Repetição inválida.');
    }
  });
}

export async function alternarFeito(itemId: string, data: string, feito: boolean): Promise<Resultado> {
  return executar(async () => {
    if (!valida(data)) throw new Error('Data inválida.');
    if (feito) {
      await prisma.agendaFeito.upsert({
        where: { itemId_data: { itemId, data } },
        create: { itemId, data },
        update: {},
      });
    } else {
      await prisma.agendaFeito.deleteMany({ where: { itemId, data } });
    }
  });
}

/** Dá baixa de uma vez em várias ocorrências atrasadas do mesmo item. */
export async function marcarVariasFeitas(itemId: string, datas: string[]): Promise<Resultado> {
  return executar(async () => {
    const boas = datas.filter((x) => valida(x));
    if (boas.length) {
      await prisma.agendaFeito.createMany({ data: boas.map((data) => ({ itemId, data })), skipDuplicates: true });
    }
  });
}

export async function alternarItemAgenda(itemId: string, ativo: boolean): Promise<Resultado> {
  return executar(async () => {
    await prisma.itemAgenda.update({ where: { id: itemId }, data: { ativo } });
  });
}

export async function excluirItemAgenda(itemId: string): Promise<Resultado> {
  return executar(async () => {
    await prisma.itemAgenda.delete({ where: { id: itemId } });
  });
}
