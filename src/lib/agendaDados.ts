import { prisma } from './prisma';
import type { Frequencia } from './agenda';
import { somaMeses } from './datas';

export interface ItemAgendaView {
  id: string;
  titulo: string;
  observacao: string | null;
  frequencia: Frequencia;
  diaSemana: number | null;
  diaMes: number | null;
  semanaDoMes: number | null;
  dataUnica: string | null;
  intervaloMeses: number;
  mesBase: number | null;
  ativo: boolean;
  criadoEm: string;
  feitos: string[];
}

/** Os itens com o que foi feito nos últimos 13 meses (o atraso olha 12 para trás). */
export async function itensDaAgenda(hoje: string): Promise<ItemAgendaView[]> {
  const desde = somaMeses(hoje, -13);
  const itens = await prisma.itemAgenda.findMany({
    orderBy: [{ ativo: 'desc' }, { titulo: 'asc' }],
    include: { feitos: { where: { data: { gte: desde } }, select: { data: true } } },
  });
  return itens.map((i) => ({
    id: i.id,
    titulo: i.titulo,
    observacao: i.observacao,
    frequencia: i.frequencia as Frequencia,
    diaSemana: i.diaSemana,
    diaMes: i.diaMes,
    semanaDoMes: i.semanaDoMes,
    dataUnica: i.dataUnica,
    intervaloMeses: i.intervaloMeses,
    mesBase: i.mesBase,
    ativo: i.ativo,
    // Dia do cadastro pelo relógio de São Paulo, como o resto do site.
    criadoEm: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(i.createdAt),
    feitos: i.feitos.map((f) => f.data),
  }));
}
