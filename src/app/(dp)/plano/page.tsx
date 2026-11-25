import { prisma } from '@/lib/prisma';
import { competenciaValida, hojeISO, mesDe, nomeCompetencia, somaMes } from '@/lib/datas';
import { faturaDoMes } from '@/lib/planoDados';
import FaturaPlano from '@/components/FaturaPlano';
import PlanoSaude from '@/components/PlanoSaude';
import BaixarExcel from '@/components/BaixarExcel';

export default async function PlanoPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const atual = mesDe(hojeISO());
  const opcoes = [somaMes(atual, 1), atual, ...Array.from({ length: 11 }, (_, i) => somaMes(atual, -(i + 1)))];
  const competencia = competenciaValida(mes) && opcoes.includes(mes) ? mes : atual;

  const [vidas, colaboradores, fatura] = await Promise.all([
    prisma.planoVida.findMany({
      include: { colaborador: { select: { nome: true, setor: true } } },
      orderBy: [{ createdAt: 'asc' }],
    }),
    prisma.colaborador.findMany({ where: { ativo: true, foraDosProcessos: false }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    faturaDoMes(competencia),
  ]);
  const planos = [...new Set(vidas.map((v) => v.plano).filter(Boolean))] as string[];

  return (
    <div>
      <div className="dp-titulo">
        <h1 className="page-title">Plano de saúde</h1>
        <div className="dp-direita"><BaixarExcel tela="plano" mes={competencia} /></div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <FaturaPlano
          competencia={competencia}
          opcoes={opcoes.map((c) => ({ valor: c, nome: nomeCompetencia(c) }))}
          folhaDe={nomeCompetencia(somaMes(competencia, 1))}
          linhas={fatura}
        />
      </div>
      <PlanoSaude
        hoje={hojeISO()}
        colaboradores={colaboradores}
        planos={planos}
        vidas={vidas.map((v) => ({
          id: v.id,
          colaboradorId: v.colaboradorId,
          colaboradorNome: v.colaborador.nome,
          setor: v.colaborador.setor,
          parentesco: v.parentesco,
          nome: v.nome ?? v.colaborador.nome,
          nascimento: v.nascimento,
          plano: v.plano,
          carteirinha: v.carteirinha,
          valorCentavos: v.valorCentavos,
          descontoCentavos: v.descontoCentavos,
          inclusao: v.inclusao,
          exclusao: v.exclusao,
          observacao: v.observacao,
        }))}
      />
    </div>
  );
}
