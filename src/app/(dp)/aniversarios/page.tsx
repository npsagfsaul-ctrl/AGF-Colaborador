import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { hojeISO, proximoAniversario, valida } from '@/lib/datas';
import Avatar from '@/components/Avatar';
import BaixarExcel from '@/components/BaixarExcel';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** O ano inteiro, mês a mês, começando pelo mês de agora. */
export default async function AniversariosPage() {
  const hoje = hojeISO();
  const mesHoje = Number(hoje.slice(5, 7));
  // Todo mundo: inclusive quem está fora dos processos do DP e os freelas.
  const [gente, freelas] = await Promise.all([
    prisma.colaborador.findMany({ where: { ativo: true }, select: { id: true, nome: true, setor: true, nascimento: true } }),
    prisma.freelancer.findMany({ where: { ativo: true }, select: { id: true, nome: true, funcao: true, nascimento: true } }),
  ]);
  const colaboradores = [
    ...gente.map((c) => ({ ...c, href: `/colaboradores/${c.id}` })),
    ...freelas.map((f) => ({ id: f.id, nome: f.nome, setor: f.funcao ? `freela · ${f.funcao}` : 'freela', nascimento: f.nascimento, href: `/freelas/${f.id}` })),
  ];
  const comData = colaboradores.filter((c) => valida(c.nascimento));
  const semData = colaboradores.length - comData.length;

  const meses = Array.from({ length: 12 }, (_, i) => ((mesHoje - 1 + i) % 12) + 1).map((m) => ({
    m,
    pessoas: comData
      .filter((c) => Number(c.nascimento!.slice(5, 7)) === m)
      .map((c) => ({ ...c, dia: Number(c.nascimento!.slice(8, 10)), prox: proximoAniversario(c.nascimento!, hoje) }))
      .sort((a, b) => a.dia - b.dia),
  }));

  return (
    <div>
      <div className="dp-titulo">
        <h1 className="page-title">Aniversariantes</h1>
        <div className="dp-direita"><BaixarExcel tela="aniversarios" /></div>
      </div>

      {semData > 0 && (
        <p className="text-muted" style={{ marginTop: -8 }}>
          {semData} sem data de nascimento. <Link href="/colaboradores" style={{ textDecoration: 'underline' }}>Completar</Link>
        </p>
      )}

      <div className="dp-paineis">
        {meses.map(({ m, pessoas }) => (
          <div key={m} className="card" style={m === mesHoje ? { borderTop: '3px solid var(--dp-acento)' } : undefined}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              {MESES[m - 1]} {pessoas.length > 0 && <span className="text-muted" style={{ fontWeight: 400 }}>· {pessoas.length}</span>}
            </div>
            {pessoas.length === 0 ? (
              <p className="text-muted" style={{ margin: 0, fontSize: '0.875rem' }}>—</p>
            ) : (
              <ul className="dp-lista">
                {pessoas.map((p) => (
                  <li key={p.id}>
                    <span className="dp-pessoa">
                      <Avatar nome={p.nome} tamanho={28} />
                      <span>
                        <Link href={p.href}>{p.nome}</Link>
                        {p.setor && <span className="text-muted" style={{ fontSize: '0.75rem' }}> · {p.setor}</span>}
                      </span>
                    </span>
                    <span style={p.prox.dias === 0 ? { color: 'var(--dp-acento)', fontWeight: 700 } : { color: 'var(--text-muted)' }}>
                      {String(p.dia).padStart(2, '0')}/{String(m).padStart(2, '0')}
                      {p.prox.dias === 0 ? ' · hoje!' : p.prox.dias <= 31 ? ` · ${p.prox.idade} anos` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
