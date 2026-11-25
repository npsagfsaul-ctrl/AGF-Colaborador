'use server';

import { prisma } from '@/lib/prisma';
import { executar, texto, type Resultado } from '@/lib/acao';
import { somaMeses, valida } from '@/lib/datas';

/** Cria (id null) ou altera uma conta de assinatura e quem usa. */
export async function salvarConta(id: string | null, fd: FormData): Promise<Resultado> {
  return executar(async () => {
    const servico = texto(fd, 'servico');
    if (!servico) throw new Error('Escreva a assinatura (HBO Max, Spotify…).');
    const proximoPagamento = texto(fd, 'proximoPagamento');
    if (proximoPagamento && !valida(proximoPagamento)) throw new Error('Próximo pagamento: data inválida.');
    const membros = fd.getAll('membros').map(String).filter(Boolean).map((cid) => ({ id: cid }));
    const dados = {
      servico,
      email: texto(fd, 'email'),
      senha: texto(fd, 'senha'),
      proximoPagamento,
      observacao: texto(fd, 'observacao'),
    };
    if (id) {
      await prisma.contaAssinatura.update({ where: { id }, data: { ...dados, colaboradores: { set: membros } } });
    } else {
      await prisma.contaAssinatura.create({ data: { ...dados, colaboradores: { connect: membros } } });
    }
  });
}

/** Pagou: o próximo pagamento passa para o mês seguinte. */
export async function pagouConta(id: string): Promise<Resultado> {
  return executar(async () => {
    const c = await prisma.contaAssinatura.findUnique({ where: { id }, select: { proximoPagamento: true } });
    if (!c?.proximoPagamento) throw new Error('Coloque a data do próximo pagamento primeiro (Editar).');
    await prisma.contaAssinatura.update({ where: { id }, data: { proximoPagamento: somaMeses(c.proximoPagamento, 1) } });
  });
}

export async function apagarConta(id: string): Promise<Resultado> {
  return executar(async () => {
    await prisma.contaAssinatura.delete({ where: { id } });
  });
}
