import { prisma } from '@/lib/prisma';
import { competenciaValida, hojeISO, mesDe, nomeCompetencia, somaMes } from '@/lib/datas';
import Metas from '@/components/Metas';
import BaixarExcel from '@/components/BaixarExcel';

export default async function MetasPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const atual = mesDe(hojeISO());
  const opcoes = Array.from({ length: 12 }, (_, i) => somaMes(atual, -i));
  const { mes } = await searchParams;
  const competencia = competenciaValida(mes) && opcoes.includes(mes) ? mes : atual;

  const [premios, colaboradores, servicos] = await Promise.all([
    prisma.premio.findMany({
      where: { competencia },
      include: { colaborador: { select: { nome: true, setor: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.colaborador.findMany({ where: { ativo: true, foraDosProcessos: false }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    prisma.premio.findMany({ select: { servico: true }, distinct: ['servico'] }),
  ]);

  return (
    <div>
      <div className="dp-titulo">
        <h1 className="page-title">Metas</h1>
        <div className="dp-direita"><BaixarExcel tela="metas" mes={competencia} /></div>
      </div>
      <Metas
        competencia={competencia}
        opcoes={opcoes.map((c) => ({ valor: c, nome: nomeCompetencia(c) }))}
        colaboradores={colaboradores}
        servicos={[...new Set(['Spotify', 'HBO Max', ...servicos.map((s) => s.servico)])]}
        premios={premios.map((p) => ({
          id: p.id,
          nome: p.colaborador.nome,
          setor: p.colaborador.setor,
          servico: p.servico,
          observacao: p.observacao,
          ativadoEm: p.ativadoEm,
        }))}
      />
    </div>
  );
}
