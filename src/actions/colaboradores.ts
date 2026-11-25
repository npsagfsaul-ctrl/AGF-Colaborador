'use server';

import { prisma } from '@/lib/prisma';
import { executar, texto, type Resultado } from '@/lib/acao';
import { valida } from '@/lib/datas';

function dataOuNull(fd: FormData, campo: string, rotulo: string): string | null {
  const v = texto(fd, campo);
  if (v && !valida(v)) throw new Error(`${rotulo}: data inválida.`);
  return v;
}

export async function criarColaborador(fd: FormData): Promise<Resultado> {
  return executar(async () => {
    const nome = texto(fd, 'nome');
    if (!nome) throw new Error('Escreva o nome.');
    const c = await prisma.colaborador.create({
      data: { nome, setor: texto(fd, 'setor'), cargo: texto(fd, 'cargo') },
    });
    return { id: c.id };
  });
}

/**
 * Cadastra vários de uma vez, um nome por linha.
 *
 * É para o primeiro dia: vinte nomes colados de uma lista são vinte cadastros
 * em um clique, em vez de vinte formulários. Linha em branco é ignorada, e um
 * "Nome - Setor" já preenche o setor.
 */
export async function criarVarios(lista: string, setorPadrao: string): Promise<Resultado> {
  return executar(async () => {
    const linhas = lista
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (linhas.length === 0) throw new Error('Cole pelo menos um nome.');

    const dados = linhas.map((l) => {
      const [nome, setor] = l.split(/\s+[-–]\s+/);
      return { nome: nome.trim(), setor: (setor ?? setorPadrao).trim() || null };
    });

    await prisma.colaborador.createMany({ data: dados });
    return { quantidade: dados.length };
  });
}

export async function atualizarColaborador(id: string, fd: FormData): Promise<Resultado> {
  return executar(async () => {
    const nome = texto(fd, 'nome');
    if (!nome) throw new Error('O nome não pode ficar vazio.');
    const meses = Number(fd.get('asoMeses') || 12);
    await prisma.colaborador.update({
      where: { id },
      data: {
        nome,
        setor: texto(fd, 'setor'),
        cargo: texto(fd, 'cargo'),
        nascimento: dataOuNull(fd, 'nascimento', 'Nascimento'),
        admissao: dataOuNull(fd, 'admissao', 'Admissão'),
        asoUltimo: dataOuNull(fd, 'asoUltimo', 'Último ASO'),
        asoMeses: Number.isFinite(meses) && meses > 0 ? Math.round(meses) : 12,
        observacao: texto(fd, 'observacao'),
        foraDosProcessos: fd.get('foraDosProcessos') === 'on',
      },
    });
  });
}

export async function alternarAtivo(id: string, ativo: boolean): Promise<Resultado> {
  return executar(async () => {
    await prisma.colaborador.update({ where: { id }, data: { ativo } });
  });
}

export async function excluirColaborador(id: string): Promise<Resultado> {
  return executar(async () => {
    await prisma.colaborador.delete({ where: { id } });
  });
}

/* ─── Férias ─── */

export async function adicionarFerias(colaboradorId: string, fd: FormData): Promise<Resultado> {
  return executar(async () => {
    const inicio = texto(fd, 'inicio');
    const fim = texto(fd, 'fim');
    if (!valida(inicio) || !valida(fim)) throw new Error('Escolha o primeiro e o último dia das férias.');
    if (fim < inicio) throw new Error('O último dia vem antes do primeiro.');
    await prisma.ferias.create({
      data: { colaboradorId, inicio, fim, observacao: texto(fd, 'observacao') },
    });
  });
}

export async function removerFerias(id: string): Promise<Resultado> {
  return executar(async () => {
    await prisma.ferias.delete({ where: { id } });
  });
}
