import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { hojeISO, situacaoAso, situacaoFerias } from '@/lib/datas';
import { saldoDe } from '@/lib/horas';
import FichaColaborador from '@/components/FichaColaborador';

export default async function FichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.colaborador.findUnique({
    where: { id },
    include: {
      ferias: { orderBy: { inicio: 'desc' } },
      lancamentos: { select: { minutos: true, data: true } },
    },
  });
  if (!c) notFound();

  const hoje = hojeISO();
  const setores = (await prisma.colaborador.findMany({
    where: { setor: { not: null } },
    select: { setor: true },
    distinct: ['setor'],
  })).map((s) => s.setor!) ;

  return (
    <div>
      <nav className="breadcrumb" style={{ marginBottom: 4 }}>
        <Link href="/colaboradores" className="breadcrumb-link">Colaboradores</Link>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{c.setor ?? 'Sem setor'}</span>
      </nav>
      <h1 className="page-title" style={{ marginBottom: 16 }}>
        {c.nome}
        {!c.ativo && <span className="badge badge-danger" style={{ marginLeft: 10, verticalAlign: 'middle' }}>desligado</span>}
      </h1>

      <FichaColaborador
        setores={setores}
        c={{
          id: c.id,
          nome: c.nome,
          setor: c.setor,
          cargo: c.cargo,
          ativo: c.ativo,
          nascimento: c.nascimento,
          admissao: c.admissao,
          asoUltimo: c.asoUltimo,
          asoMeses: c.asoMeses,
          observacao: c.observacao,
          controlaHoras: c.controlaHoras,
          saldoMinutos: saldoDe(c.saldoInicialMinutos, c.lancamentos, c.saldoInicialEm),
          ferias: c.ferias.map((f) => ({ id: f.id, inicio: f.inicio, fim: f.fim, observacao: f.observacao })),
        }}
        aso={situacaoAso(c.asoUltimo, c.asoMeses, hoje)}
        situacao={situacaoFerias(c.admissao, c.ferias, hoje)}
        hoje={hoje}
      />
    </div>
  );
}
