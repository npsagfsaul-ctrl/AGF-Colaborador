import { porNome } from '@/lib/ordem';
import { prisma } from '@/lib/prisma';
import { competenciaAtual, hojeISO, nomeCompetencia, ultimasCompetencias } from '@/lib/datas';
import ListaHolerites from '@/components/ListaHolerites';

export default async function HoleritesPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const hoje = hojeISO();
  const opcoes = ultimasCompetencias(hoje, 12);
  const { mes } = await searchParams;
  const competencia = mes && opcoes.includes(mes) ? mes : competenciaAtual(hoje);

  const colaboradores = await prisma.colaborador.findMany({
    where: { ativo: true },
    include: { holerites: { where: { competencia }, select: { entregueEm: true } } },
    orderBy: { nome: 'asc' },
  });
  colaboradores.sort(porNome);

  return (
    <ListaHolerites
      competencia={competencia}
      opcoes={opcoes.map((c) => ({ valor: c, nome: nomeCompetencia(c) }))}
      linhas={colaboradores.map((c) => ({
        id: c.id,
        nome: c.nome,
        setor: c.setor,
        entregueEm: c.holerites[0]?.entregueEm ?? null,
      }))}
    />
  );
}
