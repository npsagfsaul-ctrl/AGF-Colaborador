import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { saldoDe } from '@/lib/horas';
import { lerJornada, resumoJornada } from '@/lib/jornada';
import ControleHorasColaborador from '@/components/ControleHorasColaborador';

export default async function ColaboradorHorasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.colaborador.findUnique({
    where: { id },
    // Mais recente primeiro: o que acabou de ser lançado fica à vista.
    include: { lancamentos: { orderBy: [{ data: 'desc' }, { createdAt: 'desc' }] } },
  });
  if (!c) notFound();

  const jornada = lerJornada(c.jornadaDetalhe) ?? { semana: [], sabado: [] };

  return (
    <div>
      <nav className="breadcrumb" style={{ marginBottom: 4 }}>
        <Link href="/horas" className="breadcrumb-link">Banco de horas</Link>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">
          {[c.setor, resumoJornada(jornada)].filter(Boolean).join(' · ') || c.nome}
        </span>
      </nav>
      <h1 className="page-title" style={{ marginBottom: 16 }}>
        <Link href={`/colaboradores/${c.id}`} style={{ color: 'inherit' }}>{c.nome}</Link>
      </h1>

      <ControleHorasColaborador
        c={{
          id: c.id,
          nome: c.nome,
          setorNome: c.setor,
          controlaHoras: c.controlaHoras,
          jornadaNota: c.jornada,
          jornada,
          saldoInicialMinutos: c.saldoInicialMinutos,
          saldoInicialEm: c.saldoInicialEm,
          saldoMinutos: saldoDe(c.saldoInicialMinutos, c.lancamentos, c.saldoInicialEm),
          lancamentos: c.lancamentos.map((l) => ({ id: l.id, data: l.data, minutos: l.minutos, motivo: l.motivo })),
        }}
      />
    </div>
  );
}
