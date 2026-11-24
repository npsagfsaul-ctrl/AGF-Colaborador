import { prisma } from '@/lib/prisma';
import { competenciaValida, diasEntre, hojeISO, mesDe, nomeCompetencia, somaMes } from '@/lib/datas';
import { diasDoMes, diasPadrao, diasQueTrabalha, NOME_BENEFICIO, valorDaRecarga, type TipoBeneficio } from '@/lib/beneficio';
import BeneficioMes from './BeneficioMes';
import QuemRecebe from './QuemRecebe';
import BaixarExcel from './BaixarExcel';

/** Dias de segunda a sexta de férias dentro do mês, para avisar na linha. */
function feriasNoMes(ferias: { inicio: string; fim: string }[], comp: string) {
  const inicioMes = `${comp}-01`;
  const fimMes = `${somaMes(comp, 1)}-01`;
  return ferias
    .filter((f) => f.inicio < fimMes && f.fim >= inicioMes)
    .map((f) => ({
      inicio: f.inicio < inicioMes ? inicioMes : f.inicio,
      fim: f.fim >= fimMes ? `${comp}-${String(diasEntre(inicioMes, fimMes)).padStart(2, '0')}` : f.fim,
    }));
}

export default async function PaginaBeneficio({ tipo, mes }: { tipo: TipoBeneficio; mes?: string }) {
  const hoje = hojeISO();
  const atual = mesDe(hoje);
  const opcoes = [somaMes(atual, 1), atual, ...Array.from({ length: 11 }, (_, i) => somaMes(atual, -(i + 1)))];
  const competencia = competenciaValida(mes) && opcoes.includes(mes) ? mes : atual;

  const [colaboradores, mesSalvo] = await Promise.all([
    prisma.colaborador.findMany({
      where: { ativo: true },
      include: {
        beneficios: { where: { tipo } },
        recargas: { where: { tipo, competencia } },
        ferias: { select: { inicio: true, fim: true } },
      },
      orderBy: [{ setor: 'asc' }, { nome: 'asc' }],
    }),
    prisma.mesBeneficio.findUnique({ where: { tipo_competencia: { tipo, competencia } } }),
  ]);
  const doMes = diasDoMes(competencia);
  const diasUteis = mesSalvo?.diasUteis ?? doMes.semana;

  const recebem = colaboradores
    .filter((c) => c.beneficios[0])
    .map((c) => {
      const b = c.beneficios[0];
      const r = c.recargas[0];
      const quando = diasQueTrabalha(c.jornadaDetalhe);
      const padrao = diasPadrao(quando, diasUteis, doMes.sabados);
      const dias = r?.dias ?? padrao;
      return {
        id: c.id,
        nome: c.nome,
        setor: c.setor,
        valorCentavos: b.valorCentavos,
        porDia: b.porDia,
        vezesPorDia: b.vezesPorDia,
        padrao,
        sabado: quando.sabado,
        dias: r?.dias ?? null,
        motivo: r?.motivo ?? '',
        carregadoEm: r?.carregadoEm ?? null,
        // Carregado: vale o que foi gravado na hora. Senão, a conta de agora.
        aCarregar: r?.carregadoEm && r.valorCentavos !== null ? r.valorCentavos : valorDaRecarga(b, dias, padrao),
        ferias: feriasNoMes(c.ferias, competencia),
      };
    });

  return (
    <div>
      <div className="dp-titulo">
        <h1 className="page-title">{NOME_BENEFICIO[tipo]}</h1>
        <div className="dp-direita">
          {tipo === 'vt' && recebem.length > 0 && (
            <a href={`/api/recibo-vt?mes=${competencia}`} className="btn btn-primary btn-sm" download>
              Baixar recibo
            </a>
          )}
          <BaixarExcel tela={tipo} mes={competencia} />
        </div>
      </div>

      <BeneficioMes
        tipo={tipo}
        competencia={competencia}
        opcoes={opcoes.map((c) => ({ valor: c, nome: nomeCompetencia(c) }))}
        diasUteis={diasUteis}
        linhas={recebem}
      />

      <QuemRecebe
        tipo={tipo}
        linhas={colaboradores.map((c) => ({
          colaboradorId: c.id,
          nome: c.nome,
          setor: c.setor,
          valorCentavos: c.beneficios[0]?.valorCentavos ?? null,
          porDia: c.beneficios[0]?.porDia ?? true,
          vezesPorDia: c.beneficios[0]?.vezesPorDia ?? (tipo === 'vt' ? 2 : 1),
        }))}
      />
    </div>
  );
}
