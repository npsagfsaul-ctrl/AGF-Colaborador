import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { saldoDe } from '@/lib/horas';
import SaldosEmLote from '@/components/SaldosEmLote';
import BaixarExcel from '@/components/BaixarExcel';

export default async function HorasPage() {
  const todos = await prisma.colaborador.findMany({
    where: { ativo: true },
    include: { lancamentos: { select: { minutos: true, data: true } } },
    orderBy: { nome: 'asc' },
  });

  // Contrato sem banco de horas sai do fechamento, mas continua nomeado embaixo.
  const colaboradores = todos.filter((c) => c.controlaHoras);
  const foraDoControle = todos.filter((c) => !c.controlaHoras);
  const devendo = colaboradores.filter(
    (c) => saldoDe(c.saldoInicialMinutos, c.lancamentos, c.saldoInicialEm) < 0,
  ).length;

  const porSetor = new Map<string, typeof colaboradores>();
  for (const c of colaboradores) porSetor.set(c.setor ?? '', [...(porSetor.get(c.setor ?? '') ?? []), c]);
  const grupos = [...porSetor.entries()]
    .sort(([a], [b]) => {
      if (a === '') return 1;
      if (b === '') return -1;
      return a.localeCompare(b, 'pt-BR');
    })
    .map(([setor, lista]) => ({
      setor,
      colaboradores: lista.map((c) => ({
        id: c.id,
        nome: c.nome,
        saldoMinutos: saldoDe(c.saldoInicialMinutos, c.lancamentos, c.saldoInicialEm),
      })),
    }));

  return (
    <div>
      <div className="dp-titulo">
      <h1 className="page-title">
        Banco de horas{' '}
        <span className="text-muted" style={{ fontWeight: 400, fontSize: '1rem' }}>
          {devendo > 0 ? `${devendo} devendo` : colaboradores.length > 0 ? 'todos em dia' : ''}
        </span>
      </h1>
      <div className="dp-direita"><BaixarExcel tela="horas" /></div>
      </div>

      {colaboradores.length === 0 ? (
        <div className="card">
          <p className="text-muted" style={{ margin: 0 }}>
            Ninguém no controle de horas.{' '}
            <Link href="/colaboradores" style={{ textDecoration: 'underline' }}>Cadastre os colaboradores</Link>.
          </p>
        </div>
      ) : (
        <SaldosEmLote grupos={grupos} />
      )}

      {foraDoControle.length > 0 && (
        <details className="card" style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.9375rem' }}>
            Fora do controle de horas
            <span className="badge badge-primary" style={{ marginLeft: 8, fontSize: '0.75rem' }}>
              {foraDoControle.length}
            </span>
          </summary>
          <ul className="dp-lista" style={{ marginTop: 8 }}>
            {foraDoControle.map((c) => (
              <li key={c.id}>
                <span>
                  {c.nome}
                  {c.setor && <span className="text-muted"> · {c.setor}</span>}
                </span>
                <Link href={`/horas/${c.id}`} style={{ fontSize: '0.8125rem', fontWeight: 400, textDecoration: 'underline' }}>
                  trazer de volta
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
