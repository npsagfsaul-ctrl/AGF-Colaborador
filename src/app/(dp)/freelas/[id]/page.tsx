import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { hojeISO } from '@/lib/datas';
import FichaFreela from '@/components/FichaFreela';

export default async function FreelaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [f, funcoes] = await Promise.all([
    prisma.freelancer.findUnique({
      where: { id },
      include: { diarias: { orderBy: [{ data: 'desc' }, { createdAt: 'desc' }] } },
    }),
    prisma.freelancer.findMany({ select: { funcao: true }, distinct: ['funcao'] }),
  ]);
  if (!f) notFound();

  return (
    <div>
      <nav className="breadcrumb" style={{ marginBottom: 12 }}>
        <Link href="/freelas" className="breadcrumb-link">Freelance</Link>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{f.nome}</span>
      </nav>
      <FichaFreela
        hoje={hojeISO()}
        funcoes={funcoes.map((x) => x.funcao).filter(Boolean) as string[]}
        f={{
          id: f.id,
          nome: f.nome,
          funcao: f.funcao,
          telefone: f.telefone,
          pix: f.pix,
          diariaCentavos: f.diariaCentavos,
          observacao: f.observacao,
          nascimento: f.nascimento,
          ativo: f.ativo,
          diarias: f.diarias.map((d) => ({ id: d.id, data: d.data, valorCentavos: d.valorCentavos, observacao: d.observacao, pagoEm: d.pagoEm })),
        }}
      />
    </div>
  );
}
