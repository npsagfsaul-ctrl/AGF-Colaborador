import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatarDinheiro } from '@/lib/dinheiro';
import Avatar from '@/components/Avatar';
import NovoFreela from '@/components/NovoFreela';
import BaixarExcel from '@/components/BaixarExcel';

export default async function FreelasPage() {
  const freelas = await prisma.freelancer.findMany({
    include: { diarias: { select: { valorCentavos: true, pagoEm: true, data: true } } },
    orderBy: { nome: 'asc' },
  });
  const ativos = freelas.filter((f) => f.ativo);
  const inativos = freelas.filter((f) => !f.ativo);
  const aPagar = (f: (typeof freelas)[number]) => f.diarias.filter((d) => !d.pagoEm).reduce((s, d) => s + d.valorCentavos, 0);
  const totalAPagar = freelas.reduce((s, f) => s + aPagar(f), 0);
  const funcoes = [...new Set(freelas.map((f) => f.funcao).filter(Boolean))] as string[];

  return (
    <div>
      <div className="dp-titulo">
        <h1 className="page-title">Freelance</h1>
        {totalAPagar > 0 && <span className="dp-etiqueta perigo">{formatarDinheiro(totalAPagar)} a pagar</span>}
        <div className="dp-direita"><BaixarExcel tela="freelas" /></div>
      </div>

      <NovoFreela funcoes={funcoes} />

      {ativos.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <ul className="dp-lista">
            {ativos.map((f) => {
              const deve = aPagar(f);
              const ultima = f.diarias.map((d) => d.data).sort().at(-1);
              return (
                <li key={f.id}>
                  <span className="dp-pessoa">
                    <Avatar nome={f.nome} />
                    <span>
                      <Link href={`/freelas/${f.id}`}>{f.nome}</Link>
                      {f.funcao && <> <span className="dp-etiqueta">{f.funcao}</span></>}
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                        {[f.telefone, ultima && `último dia ${ultima.split('-').reverse().join('/')}`].filter(Boolean).join(' · ')}
                      </div>
                    </span>
                  </span>
                  <span className="dp-num" style={{ color: deve ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {deve ? `${formatarDinheiro(deve)} a pagar` : 'em dia'}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {inativos.length > 0 && (
        <details className="card" style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
            Inativos <span className="badge badge-primary" style={{ marginLeft: 8 }}>{inativos.length}</span>
          </summary>
          <ul className="dp-lista" style={{ marginTop: 8 }}>
            {inativos.map((f) => (
              <li key={f.id}>
                <Link href={`/freelas/${f.id}`}>{f.nome}</Link>
                <span className="text-muted">{f.funcao ?? ''}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
