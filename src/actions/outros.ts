'use server';

import { prisma } from '@/lib/prisma';
import { executar, texto, type Resultado } from '@/lib/acao';
import { parseDinheiro } from '@/lib/dinheiro';
import { competenciaValida, hojeISO, valida } from '@/lib/datas';

function data(fd: FormData, campo: string, rotulo: string): string | null {
  const v = texto(fd, campo);
  if (v && !valida(v)) throw new Error(`${rotulo}: data inválida.`);
  return v;
}

function dinheiro(fd: FormData, campo: string, rotulo: string): number | null {
  const v = texto(fd, campo);
  if (!v) return null;
  const c = parseDinheiro(v);
  if (c === null) throw new Error(`${rotulo}: valor mal escrito. Use, por exemplo, 1.850,00.`);
  return c;
}

/* ─── Salários ─── */

export async function registrarSalario(colaboradorId: string, fd: FormData): Promise<Resultado> {
  return executar(async () => {
    const valor = dinheiro(fd, 'valor', 'Salário');
    const desde = data(fd, 'desde', 'A partir de');
    if (!valor) throw new Error('Escreva o salário.');
    if (!desde) throw new Error('Escolha a partir de quando vale.');
    await prisma.salario.create({
      data: { colaboradorId, valorCentavos: valor, desde, motivo: texto(fd, 'motivo') },
    });
  });
}

export async function apagarSalario(id: string): Promise<Resultado> {
  return executar(async () => {
    await prisma.salario.delete({ where: { id } });
  });
}

/* ─── Plano de saúde ─── */

export async function incluirNoPlano(fd: FormData): Promise<Resultado> {
  return executar(async () => {
    const colaboradorId = texto(fd, 'colaboradorId');
    const parentesco = texto(fd, 'parentesco') ?? 'Titular';
    const nome = texto(fd, 'nome');
    if (!colaboradorId) throw new Error('Escolha o colaborador.');
    if (parentesco !== 'Titular' && !nome) throw new Error('Escreva o nome do dependente.');
    await prisma.planoVida.create({
      data: {
        colaboradorId,
        parentesco,
        nome: parentesco === 'Titular' ? null : nome,
        nascimento: data(fd, 'nascimento', 'Nascimento'),
        plano: texto(fd, 'plano'),
        carteirinha: texto(fd, 'carteirinha'),
        valorCentavos: dinheiro(fd, 'valor', 'Valor'),
        descontoCentavos: dinheiro(fd, 'desconto', 'Desconto'),
        inclusao: data(fd, 'inclusao', 'Inclusão') ?? hojeISO(),
        observacao: texto(fd, 'observacao'),
      },
    });
  });
}

export async function atualizarVida(id: string, fd: FormData): Promise<Resultado> {
  return executar(async () => {
    await prisma.planoVida.update({
      where: { id },
      data: {
        plano: texto(fd, 'plano'),
        carteirinha: texto(fd, 'carteirinha'),
        valorCentavos: dinheiro(fd, 'valor', 'Valor'),
        descontoCentavos: dinheiro(fd, 'desconto', 'Desconto'),
        observacao: texto(fd, 'observacao'),
      },
    });
  });
}

/** Saída do plano: a linha fica, com a data de exclusão, como histórico. */
export async function excluirDoPlano(id: string, quando: string): Promise<Resultado> {
  return executar(async () => {
    if (!valida(quando)) throw new Error('Data de exclusão inválida.');
    await prisma.planoVida.update({ where: { id }, data: { exclusao: quando } });
  });
}

/** Apagar de vez: só para cadastro feito por engano. */
export async function apagarVida(id: string): Promise<Resultado> {
  return executar(async () => {
    await prisma.planoVida.delete({ where: { id } });
  });
}

/* ─── Metas (prêmios) ─── */

export async function registrarPremio(fd: FormData): Promise<Resultado> {
  return executar(async () => {
    const colaboradorId = texto(fd, 'colaboradorId');
    const servico = texto(fd, 'servico');
    const competencia = texto(fd, 'competencia');
    if (!colaboradorId) throw new Error('Escolha quem ganhou.');
    if (!servico) throw new Error('Escolha a assinatura.');
    if (!competenciaValida(competencia)) throw new Error('Mês inválido.');
    await prisma.premio.create({
      data: { colaboradorId, servico, competencia, observacao: texto(fd, 'observacao') },
    });
  });
}

export async function marcarPremioAtivado(id: string, ativado: boolean): Promise<Resultado> {
  return executar(async () => {
    await prisma.premio.update({ where: { id }, data: { ativadoEm: ativado ? hojeISO() : null } });
  });
}

export async function apagarPremio(id: string): Promise<Resultado> {
  return executar(async () => {
    await prisma.premio.delete({ where: { id } });
  });
}

/* ─── Freelancers ─── */

function dadosFreela(fd: FormData) {
  const nome = texto(fd, 'nome');
  if (!nome) throw new Error('Escreva o nome.');
  return {
    nome,
    funcao: texto(fd, 'funcao'),
    telefone: texto(fd, 'telefone'),
    pix: texto(fd, 'pix'),
    diariaCentavos: dinheiro(fd, 'diaria', 'Diária'),
    observacao: texto(fd, 'observacao'),
  };
}

export async function criarFreela(fd: FormData): Promise<Resultado> {
  return executar(async () => {
    const f = await prisma.freelancer.create({ data: dadosFreela(fd) });
    return { id: f.id };
  });
}

export async function atualizarFreela(id: string, fd: FormData): Promise<Resultado> {
  return executar(async () => {
    await prisma.freelancer.update({ where: { id }, data: dadosFreela(fd) });
  });
}

export async function alternarFreelaAtivo(id: string, ativo: boolean): Promise<Resultado> {
  return executar(async () => {
    await prisma.freelancer.update({ where: { id }, data: { ativo } });
  });
}

export async function excluirFreela(id: string): Promise<Resultado> {
  return executar(async () => {
    await prisma.freelancer.delete({ where: { id } });
  });
}

export async function lancarDiaria(freelancerId: string, fd: FormData): Promise<Resultado> {
  return executar(async () => {
    const quando = data(fd, 'data', 'Data');
    const valor = dinheiro(fd, 'valor', 'Valor');
    if (!quando) throw new Error('Escolha o dia trabalhado.');
    if (!valor) throw new Error('Escreva o valor da diária.');
    await prisma.diaria.create({
      data: { freelancerId, data: quando, valorCentavos: valor, observacao: texto(fd, 'observacao') },
    });
  });
}

export async function marcarDiarias(ids: string[], pago: boolean): Promise<Resultado> {
  return executar(async () => {
    await prisma.diaria.updateMany({
      where: { id: { in: ids } },
      data: { pagoEm: pago ? hojeISO() : null },
    });
    return { quantidade: ids.length };
  });
}

export async function apagarDiaria(id: string): Promise<Resultado> {
  return executar(async () => {
    await prisma.diaria.delete({ where: { id } });
  });
}
