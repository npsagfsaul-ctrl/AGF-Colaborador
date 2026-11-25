import { prisma } from '@/lib/prisma';
import { competenciaValida, hojeISO, mesDe, nomeCompetencia, somaMes } from '@/lib/datas';
import Metas from '@/components/Metas';
import ContasAssinatura from '@/components/ContasAssinatura';
import BaixarExcel from '@/components/BaixarExcel';

export default async function MetasPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const atual = mesDe(hojeISO());
  const opcoes = Array.from({ length: 12 }, (_, i) => somaMes(atual, -i));
  const { mes } = await searchParams;
  const competencia = competenciaValida(mes) && opcoes.includes(mes) ? mes : atual;

  const [premios, colaboradores, servicos, contas] = await Promise.all([
    prisma.premio.findMany({
      where: { competencia },
      include: { colaborador: { select: { nome: true, setor: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.colaborador.findMany({ where: { ativo: true, foraDosProcessos: false }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    prisma.premio.findMany({ select: { servico: true }, distinct: ['servico'] }),
    prisma.contaAssinatura.findMany({
      include: { colaboradores: { select: { id: true, nome: true }, orderBy: { nome: 'asc' } } },
      orderBy: [{ servico: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);
  const nomesServicos = [...new Set(['HBO Max', 'Spotify', ...servicos.map((s) => s.servico), ...contas.map((c) => c.servico)])];

  return (
    <div>
      <div className="dp-titulo">
        <h1 className="page-title">Metas</h1>
        <div className="dp-direita"><BaixarExcel tela="metas" mes={competencia} /></div>
      </div>
      <div style={{ marginBottom: 24 }}>
        <ContasAssinatura
          hoje={hojeISO()}
          colaboradores={colaboradores}
          servicos={nomesServicos}
          contas={contas.map((c) => ({
            id: c.id,
            servico: c.servico,
            email: c.email,
            senha: c.senha,
            proximoPagamento: c.proximoPagamento,
            valorCentavos: c.valorCentavos,
            telefone: c.telefone,
            linkConvite: c.linkConvite,
            endereco: c.endereco,
            observacao: c.observacao,
            membros: c.colaboradores,
          }))}
        />
      </div>
      <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 12px' }}>Quem bateu a meta</h2>
      <Metas
        competencia={competencia}
        opcoes={opcoes.map((c) => ({ valor: c, nome: nomeCompetencia(c) }))}
        colaboradores={colaboradores}
        servicos={nomesServicos}
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
