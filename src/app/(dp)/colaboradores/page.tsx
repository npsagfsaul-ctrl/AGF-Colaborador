import { Fragment } from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { dataBR, hojeISO, situacaoAso, valida } from '@/lib/datas';
import NovoColaborador from '@/components/NovoColaborador';
import Avatar from '@/components/Avatar';
import BaixarExcel from '@/components/BaixarExcel';

function porSetor<T extends { setor: string | null }>(lista: T[]) {
  const mapa = new Map<string, T[]>();
  for (const c of lista) mapa.set(c.setor ?? '', [...(mapa.get(c.setor ?? '') ?? []), c]);
  return [...mapa.entries()].sort(([a], [b]) => {
    if (a === '') return 1;
    if (b === '') return -1;
    return a.localeCompare(b, 'pt-BR');
  });
}

export default async function ColaboradoresPage() {
  const hoje = hojeISO();
  const todos = await prisma.colaborador.findMany({ orderBy: { nome: 'asc' } });
  const ativos = todos.filter((c) => c.ativo);
  const desligados = todos.filter((c) => !c.ativo);
  const setores = [...new Set(todos.map((c) => c.setor).filter(Boolean))] as string[];

  return (
    <div>
      <div className="dp-titulo">
        <h1 className="page-title">
          Colaboradores <span className="text-muted" style={{ fontWeight: 400, fontSize: '1rem' }}>{ativos.length}</span>
        </h1>
        <div className="dp-direita"><BaixarExcel tela="colaboradores" /></div>
      </div>

      <NovoColaborador setores={setores} />

      {ativos.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Nome</th>
                  <th className="dp-so-largo" style={{ textAlign: 'left' }}>Cargo</th>
                  <th style={{ textAlign: 'left' }}>Aniversário</th>
                  <th style={{ textAlign: 'left' }}>ASO</th>
                </tr>
              </thead>
              <tbody>
                {porSetor(ativos).map(([setor, lista]) => (
                  <Fragment key={setor || 'sem-setor'}>
                    <tr>
                      <td colSpan={4} style={{
                        background: 'var(--surface-2)', fontSize: '0.75rem', fontWeight: 700,
                        letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)',
                      }}>
                        {setor || 'Sem setor'}
                      </td>
                    </tr>
                    {lista.map((c) => {
                      const aso = situacaoAso(c.asoUltimo, c.asoMeses, hoje);
                      return (
                        <tr key={c.id}>
                          <td>
                            <Link href={`/colaboradores/${c.id}`} className="dp-pessoa" style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>
                              <Avatar nome={c.nome} />
                              {c.nome}
                            </Link>
                          </td>
                          <td className="text-muted dp-so-largo">{c.cargo ?? '—'}</td>
                          <td>{valida(c.nascimento) ? dataBR(c.nascimento).slice(0, 5) : <span className="text-muted">—</span>}</td>
                          <td>
                            {aso.situacao === 'sem-registro' ? (
                              <span className="text-muted">—</span>
                            ) : (
                              <span style={{
                                color: aso.situacao === 'vencido' ? 'var(--danger)'
                                  : aso.situacao === 'vence-logo' ? 'var(--warning)' : undefined,
                                fontWeight: aso.situacao === 'em-dia' ? undefined : 600,
                              }}>
                                {aso.situacao === 'vencido' ? 'venceu ' : 'até '}{dataBR(aso.vencimento)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {desligados.length > 0 && (
        <details className="card" style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
            Desligados <span className="badge badge-primary" style={{ marginLeft: 8 }}>{desligados.length}</span>
          </summary>
          <ul className="dp-lista" style={{ marginTop: 8 }}>
            {desligados.map((c) => (
              <li key={c.id}>
                <Link href={`/colaboradores/${c.id}`}>{c.nome}</Link>
                <span className="text-muted">{c.setor ?? ''}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
