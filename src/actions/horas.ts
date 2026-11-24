'use server';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { executar, texto, type Resultado } from '@/lib/acao';
import { parseHoras } from '@/lib/horas';
import { valida } from '@/lib/datas';
import { minutosDoPeriodo, type Jornada, type Periodo } from '@/lib/jornada';

/** O saldo de onde a conta começa, copiado do relatório do ponto. */
export async function definirSaldoInicial(id: string, textoSaldo: string, dataISO: string): Promise<Resultado> {
  return executar(async () => {
    const minutos = parseHoras(textoSaldo);
    if (minutos === null) {
      throw new Error('Escreva o saldo como horas:minutos — por exemplo 03:47, ou -03:47 se forem horas devidas.');
    }
    await prisma.colaborador.update({
      where: { id },
      data: { saldoInicialMinutos: minutos, saldoInicialEm: valida(dataISO) ? dataISO : null },
    });
  });
}

/** Contrato sem banco de horas sai do fechamento, mas continua no resto do site. */
export async function definirControleDeHoras(id: string, controla: boolean): Promise<Resultado> {
  return executar(async () => {
    await prisma.colaborador.update({ where: { id }, data: { controlaHoras: controla } });
  });
}

/**
 * A jornada contratada. Guarda só períodos completos: meio período digitado
 * some em vez de ser gravado pela metade.
 */
export async function definirJornada(id: string, jornada: Jornada, nota: string): Promise<Resultado> {
  return executar(async () => {
    const limpar = (ps: Periodo[]) =>
      (ps ?? [])
        .map((p) => ({ entrada: (p.entrada ?? '').trim(), saida: (p.saida ?? '').trim() }))
        .filter((p) => minutosDoPeriodo(p) !== null);

    const detalhe = { semana: limpar(jornada?.semana ?? []), sabado: limpar(jornada?.sabado ?? []) };
    const vazia = detalhe.semana.length === 0 && detalhe.sabado.length === 0;

    await prisma.colaborador.update({
      where: { id },
      data: { jornada: nota.trim() || null, jornadaDetalhe: vazia ? Prisma.DbNull : detalhe },
    });
  });
}

/**
 * Os saldos de todo mundo de uma vez, no fechamento. Ou grava tudo ou não
 * grava nada: com um valor mal escrito no meio, gravar os outros deixaria o
 * fechamento pela metade sem ninguém perceber qual faltou.
 */
export async function salvarSaldosEmLote(
  dataISO: string,
  entradas: { id: string; nome: string; texto: string }[],
): Promise<Resultado> {
  return executar(async () => {
    const invalidos: string[] = [];
    const validos: { id: string; minutos: number }[] = [];

    for (const e of entradas) {
      const t = (e.texto ?? '').trim();
      if (!t) continue;
      const minutos = parseHoras(t);
      if (minutos === null) invalidos.push(e.nome);
      else validos.push({ id: e.id, minutos });
    }

    if (invalidos.length > 0) {
      throw new Error(`Saldo mal escrito em: ${invalidos.join(', ')}. Use horas:minutos, como -03:14.`);
    }
    if (validos.length === 0) throw new Error('Nenhum saldo preenchido.');

    const data = valida(dataISO) ? dataISO : null;
    await prisma.$transaction(
      validos.map((v) =>
        prisma.colaborador.update({
          where: { id: v.id },
          data: { saldoInicialMinutos: v.minutos, saldoInicialEm: data },
        }),
      ),
    );
    return { quantidade: validos.length };
  });
}

export async function criarLancamentoHoras(colaboradorId: string, fd: FormData): Promise<Resultado> {
  return executar(async () => {
    const data = texto(fd, 'data');
    const tempo = texto(fd, 'tempo') ?? '';
    const sinal = fd.get('sinal') === 'menos' ? -1 : 1;

    if (!valida(data)) throw new Error('Escolha a data do lançamento.');
    const minutos = parseHoras(tempo);
    if (minutos === null) throw new Error('Escreva as horas como horas:minutos — por exemplo 01:30.');
    if (minutos === 0) throw new Error('O lançamento está zerado — não há o que registrar.');

    // O sinal vem do seletor; "-01:30" com "a menos" não vira +01:30.
    await prisma.lancamentoHoras.create({
      data: { colaboradorId, data, minutos: Math.abs(minutos) * sinal, motivo: texto(fd, 'motivo') },
    });
  });
}

export async function deletarLancamentoHoras(id: string): Promise<Resultado> {
  return executar(async () => {
    await prisma.lancamentoHoras.delete({ where: { id } });
  });
}
