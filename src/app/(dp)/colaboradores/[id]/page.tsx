import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { dataBR, diasEntre, hojeISO, proximoAniversario, situacaoAso, situacaoFerias, valida } from '@/lib/datas';
import { NOME_BENEFICIO } from '@/lib/beneficio';
import Avatar from '@/components/Avatar';
import { saldoDe } from '@/lib/horas';
import FichaColaborador from '@/components/FichaColaborador';

export default async function FichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.colaborador.findUnique({
    where: { id },
    include: {
      ferias: { orderBy: { inicio: 'desc' } },
      lancamentos: { select: { minutos: true, data: true } },
      beneficios: { select: { tipo: true } },
      planoVidas: { select: { parentesco: true, exclusao: true } },
    },
  });
  if (!c) notFound();

  const hoje = hojeISO();
  const setores = (await prisma.colaborador.findMany({
    where: { setor: { not: null } },
    select: { setor: true },
    distinct: ['setor'],
  })).map((s) => s.setor!) ;

  const aso = situacaoAso(c.asoUltimo, c.asoMeses, hoje);
  const aniversario = valida(c.nascimento) ? proximoAniversario(c.nascimento, hoje) : null;
  const noPlano = c.planoVidas.filter((v) => !v.exclusao || v.exclusao > hoje);

  return (
    <div>
      <nav className="breadcrumb" style={{ marginBottom: 12 }}>
        <Link href="/colaboradores" className="breadcrumb-link">Colaboradores</Link>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{c.nome}</span>
      </nav>

      {/* Cabeçalho no jeito do Sólides: iniciais no anel, nome, etiquetas e a linha de dados. */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="dp-cabecalho">
          <Avatar nome={c.nome} tamanho={76} anel />
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 className="page-title" style={{ margin: 0 }}>{c.nome}</h1>
            <div className="dp-etiquetas">
              {c.setor && <span className="dp-etiqueta">{c.setor}</span>}
              {c.cargo && <span className="dp-etiqueta">{c.cargo}</span>}
              {c.foraDosProcessos && <span className="dp-etiqueta">só aniversário</span>}
              {!c.ativo && <span className="dp-etiqueta perigo">desligado</span>}
              {aso.situacao === 'vencido' && <span className="dp-etiqueta perigo">ASO vencido</span>}
            </div>
          </div>
        </div>
        <div className="dp-dados">
          {valida(c.admissao) && (
            <span>Admissão <strong>{dataBR(c.admissao)}</strong> · {tempoDeCasa(c.admissao, hoje)}</span>
          )}
          {aniversario && (
            <span>Aniversário <strong>{dataBR(aniversario.data).slice(0, 5)}</strong>{aniversario.dias === 0 ? ' · hoje!' : ''}</span>
          )}
          {aso.vencimento && <span>ASO até <strong>{dataBR(aso.vencimento)}</strong></span>}
          {c.beneficios.length > 0 && (
            <span>
              Recebe <strong>{c.beneficios.map((b) => NOME_BENEFICIO[b.tipo as 'va' | 'vt']).join(' e ')}</strong>
            </span>
          )}
          {noPlano.length > 0 && (
            <span>Plano de saúde <strong>{noPlano.length === 1 ? 'sim' : `${noPlano.length} vidas`}</strong></span>
          )}
        </div>
      </div>

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
          foraDosProcessos: c.foraDosProcessos,
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

/** "3 anos e 2 meses de casa". */
function tempoDeCasa(admissao: string, hoje: string): string {
  const meses = Math.floor(diasEntre(admissao, hoje) / 30.4375);
  const a = Math.floor(meses / 12);
  const m = meses % 12;
  if (meses < 1) return 'menos de 1 mês de casa';
  const partes = [a && `${a} ano${a > 1 ? 's' : ''}`, m && `${m} mês${m > 1 ? 'es' : ''}`].filter(Boolean);
  return `${partes.join(' e ')} de casa`.replace('mêses', 'meses');
}
