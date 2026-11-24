import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatarHoras, saldoDe } from '@/lib/horas';
import {
  competenciaAtual,
  dataBR,
  diasEntre,
  hojeISO,
  nomeCompetencia,
  proximoAniversario,
  situacaoAso,
  situacaoFerias,
  somaDias,
  valida,
} from '@/lib/datas';

function quando(dias: number) {
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  if (dias < 0) return `há ${-dias} dia${dias === -1 ? '' : 's'}`;
  return `em ${dias} dias`;
}

function Bloco({ titulo, children, cor }: { titulo: string; children: React.ReactNode; cor?: string }) {
  return (
    <div className="card" style={cor ? { borderTop: `3px solid ${cor}` } : undefined}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{titulo}</div>
      {children}
    </div>
  );
}

/**
 * O Painel mostra só o que pede atenção. Bloco sem nada não aparece: tela
 * cheia de "nenhum" é tela que se aprende a não ler.
 */
export default async function PainelPage() {
  const hoje = hojeISO();
  const competencia = competenciaAtual(hoje);

  const colaboradores = await prisma.colaborador.findMany({
    where: { ativo: true },
    include: {
      ferias: { select: { inicio: true, fim: true } },
      lancamentos: { select: { minutos: true, data: true } },
      holerites: { where: { competencia }, select: { entregueEm: true } },
    },
    orderBy: { nome: 'asc' },
  });

  if (colaboradores.length === 0) {
    return (
      <div className="card">
        <p style={{ margin: 0 }}>
          Nenhum colaborador ainda.{' '}
          <Link href="/colaboradores" style={{ textDecoration: 'underline' }}>Cadastre a equipe</Link> para começar.
        </p>
      </div>
    );
  }

  const aniversarios = colaboradores
    .filter((c) => valida(c.nascimento))
    .map((c) => ({ c, ...proximoAniversario(c.nascimento!, hoje) }))
    .filter((a) => a.dias <= 30)
    .sort((a, b) => a.dias - b.dias);

  const asos = colaboradores
    .map((c) => ({ c, ...situacaoAso(c.asoUltimo, c.asoMeses, hoje) }))
    .filter((a) => a.situacao === 'vencido' || a.situacao === 'vence-logo')
    .sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0));

  const deFerias = colaboradores
    .flatMap((c) => c.ferias.map((f) => ({ c, ...f })))
    .filter((f) => f.fim >= hoje && diasEntre(hoje, f.inicio) <= 30)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));

  // Período vencido ou que vence nos próximos 4 meses: dá tempo de marcar.
  const feriasAVencer = colaboradores
    .map((c) => ({ c, s: situacaoFerias(c.admissao, c.ferias, hoje) }))
    .filter((x) => x.s?.pendente && diasEntre(hoje, x.s.pendente.limite) <= 120)
    .map((x) => ({ c: x.c, p: x.s!.pendente!, dias: diasEntre(hoje, x.s!.pendente!.limite) }))
    .sort((a, b) => a.dias - b.dias);

  const semHolerite = colaboradores.filter((c) => !c.holerites[0]?.entregueEm);

  const devendo = colaboradores
    .filter((c) => c.controlaHoras)
    .map((c) => ({ c, saldo: saldoDe(c.saldoInicialMinutos, c.lancamentos, c.saldoInicialEm) }))
    .filter((x) => x.saldo < 0)
    .sort((a, b) => a.saldo - b.saldo);

  const nada =
    aniversarios.length + asos.length + deFerias.length + feriasAVencer.length +
    semHolerite.length + devendo.length === 0;

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 16 }}>Painel</h1>

      {nada && (
        <div className="card">
          <p className="text-muted" style={{ margin: 0 }}>Nada pedindo atenção hoje.</p>
        </div>
      )}

      <div className="dp-paineis">
        {aniversarios.length > 0 && (
          <Bloco titulo="Aniversários" cor="var(--primary)">
            <ul className="dp-lista">
              {aniversarios.map((a) => (
                <li key={a.c.id}>
                  <Link href={`/colaboradores/${a.c.id}`}>{a.c.nome}</Link>
                  <span style={a.dias === 0 ? { fontWeight: 700, color: 'var(--primary)' } : { color: 'var(--text-muted)' }}>
                    {dataBR(a.data).slice(0, 5)} · {quando(a.dias)}
                  </span>
                </li>
              ))}
            </ul>
          </Bloco>
        )}

        {asos.length > 0 && (
          <Bloco titulo="ASO" cor="var(--danger)">
            <ul className="dp-lista">
              {asos.map((a) => (
                <li key={a.c.id}>
                  <Link href={`/colaboradores/${a.c.id}`}>{a.c.nome}</Link>
                  <span style={{ color: a.situacao === 'vencido' ? 'var(--danger)' : 'var(--warning)', fontWeight: 600 }}>
                    {a.situacao === 'vencido' ? 'venceu' : 'vence'} {dataBR(a.vencimento)}
                  </span>
                </li>
              ))}
            </ul>
          </Bloco>
        )}

        {feriasAVencer.length > 0 && (
          <Bloco titulo="Férias para marcar" cor="var(--warning)">
            <ul className="dp-lista">
              {feriasAVencer.map((f) => (
                <li key={f.c.id}>
                  <Link href={`/colaboradores/${f.c.id}`}>{f.c.nome}</Link>
                  <span style={{ color: f.dias < 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: f.dias < 0 ? 600 : undefined }}>
                    {f.p.diasRestantes} dias · {f.dias < 0 ? 'venceu' : 'até'} {dataBR(f.p.limite)}
                  </span>
                </li>
              ))}
            </ul>
          </Bloco>
        )}

        {deFerias.length > 0 && (
          <Bloco titulo="De férias" cor="var(--success)">
            <ul className="dp-lista">
              {deFerias.map((f, i) => (
                <li key={`${f.c.id}-${i}`}>
                  <Link href={`/colaboradores/${f.c.id}`}>{f.c.nome}</Link>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {f.inicio <= hoje ? `volta ${dataBR(somaDias(f.fim, 1))}` : `sai ${dataBR(f.inicio)}`}
                  </span>
                </li>
              ))}
            </ul>
          </Bloco>
        )}

        {semHolerite.length > 0 && (
          <Bloco titulo={`Holerites de ${nomeCompetencia(competencia)}`} cor="var(--info)">
            <p style={{ margin: '0 0 8px' }}>
              <strong>{semHolerite.length}</strong> de {colaboradores.length} ainda não entregues.
            </p>
            <Link href="/holerites" className="btn btn-outline btn-sm">Marcar entregas</Link>
          </Bloco>
        )}

        {devendo.length > 0 && (
          <Bloco titulo="Devendo horas" cor="var(--danger)">
            <ul className="dp-lista">
              {devendo.map((d) => (
                <li key={d.c.id}>
                  <Link href={`/horas/${d.c.id}`}>{d.c.nome}</Link>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--danger)' }}>
                    {formatarHoras(d.saldo, true)}
                  </span>
                </li>
              ))}
            </ul>
          </Bloco>
        )}
      </div>
    </div>
  );
}
