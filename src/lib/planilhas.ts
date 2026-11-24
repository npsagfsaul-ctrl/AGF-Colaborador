import { prisma } from './prisma';
import {
  competenciaValida,
  dataBR,
  diasUteisDoMes,
  hojeISO,
  mesDe,
  nomeCompetencia,
  situacaoAso,
  situacaoFerias,
  valida,
} from './datas';
import { formatarHoras, jaEstaNoRelatorio, saldoDe } from './horas';
import { lerJornada, minutosDaSemana, type Periodo } from './jornada';
import { NOME_BENEFICIO, valorDaRecarga, type TipoBeneficio } from './beneficio';
import { NOMES_MES, ocorrenciasNoMes, rotuloFrequencia } from './agenda';
import { feriadosDoAno } from './feriados';
import { itensDaAgenda } from './agendaDados';

/**
 * O conteúdo de cada planilha, sem nada de Excel: abas, colunas e linhas.
 * A rota de exportação transforma isto em .xlsx.
 *
 * Datas saem como data de verdade (dá para ordenar e filtrar no Excel),
 * dinheiro como número em reais com formato de moeda, e horas como texto
 * "+03:47", que é como aparecem no relatório do ponto.
 */
export type TipoColuna = 'texto' | 'data' | 'dinheiro' | 'numero';
export interface Coluna { titulo: string; tipo?: TipoColuna; largura?: number }
export type Celula = string | number | null;
export interface Aba { nome: string; colunas: Coluna[]; linhas: Celula[][] }
export interface Planilha { arquivo: string; abas: Aba[] }

const T = (titulo: string, largura = 18): Coluna => ({ titulo, largura });
const D = (titulo: string): Coluna => ({ titulo, tipo: 'data', largura: 13 });
const R = (titulo: string): Coluna => ({ titulo, tipo: 'dinheiro', largura: 14 });
const N = (titulo: string): Coluna => ({ titulo, tipo: 'numero', largura: 10 });

/** Data "aaaa-mm-dd" fica como está; a rota converte. Inválida vira vazio. */
const d = (s: string | null | undefined) => (valida(s) ? s : null);
/** Centavos → reais. */
const r = (c: number | null | undefined) => (c === null || c === undefined ? null : c / 100);

async function ativos() {
  return prisma.colaborador.findMany({ where: { ativo: true }, orderBy: [{ setor: 'asc' }, { nome: 'asc' }] });
}

/* ─── Cada tela ─── */

async function colaboradores(): Promise<Aba[]> {
  const hoje = hojeISO();
  const lista = await prisma.colaborador.findMany({
    include: { ferias: { select: { inicio: true, fim: true, observacao: true } } },
    orderBy: [{ ativo: 'desc' }, { setor: 'asc' }, { nome: 'asc' }],
  });
  return [
    {
      nome: 'Colaboradores',
      colunas: [T('Nome', 30), T('Setor'), T('Cargo'), T('Situação', 11), D('Nascimento'), D('Admissão'), D('Último ASO'), D('ASO vence'), N('Férias a tirar (dias)'), D('Tirar férias até'), T('Observação', 30)],
      linhas: lista.map((c) => {
        const aso = situacaoAso(c.asoUltimo, c.asoMeses, hoje);
        const f = situacaoFerias(c.admissao, c.ferias, hoje);
        return [c.nome, c.setor, c.cargo, c.ativo ? 'Ativo' : 'Desligado', d(c.nascimento), d(c.admissao), d(c.asoUltimo), d(aso.vencimento), f?.diasPendentes ?? null, d(f?.pendente?.limite), c.observacao];
      }),
    },
    {
      nome: 'Férias',
      colunas: [T('Nome', 30), T('Setor'), D('Primeiro dia'), D('Último dia'), N('Dias'), T('Observação', 30)],
      linhas: lista.flatMap((c) =>
        c.ferias
          .sort((a, b) => a.inicio.localeCompare(b.inicio))
          .map((f) => [c.nome, c.setor, d(f.inicio), d(f.fim), Math.round((Date.parse(f.fim) - Date.parse(f.inicio)) / 86_400_000) + 1, f.observacao]),
      ),
    },
  ];
}

async function horas(): Promise<Aba[]> {
  const lista = await prisma.colaborador.findMany({
    where: { ativo: true },
    include: { lancamentos: { orderBy: { data: 'asc' } } },
    orderBy: [{ setor: 'asc' }, { nome: 'asc' }],
  });
  return [
    {
      nome: 'Saldos',
      colunas: [T('Nome', 30), T('Setor'), T('No controle', 11), T('Saldo do relatório', 16), D('Data do relatório'), T('Saldo atual', 12)],
      linhas: lista.map((c) => [
        c.nome, c.setor, c.controlaHoras ? 'Sim' : 'Não',
        formatarHoras(c.saldoInicialMinutos, true), d(c.saldoInicialEm),
        formatarHoras(saldoDe(c.saldoInicialMinutos, c.lancamentos, c.saldoInicialEm), true),
      ]),
    },
    {
      nome: 'Lançamentos',
      colunas: [T('Nome', 30), D('Data'), T('Horas', 10), T('Motivo', 30), T('Já no relatório', 14)],
      linhas: lista.flatMap((c) =>
        c.lancamentos.map((l) => [c.nome, d(l.data), formatarHoras(l.minutos, true), l.motivo, jaEstaNoRelatorio(l.data, c.saldoInicialEm) ? 'Sim' : 'Não']),
      ),
    },
  ];
}

function horario(ps: Periodo[]) {
  return ps.map((p) => `${p.entrada}-${p.saida}`).join(' / ');
}

async function horarios(): Promise<Aba[]> {
  const lista = await ativos();
  return [{
    nome: 'Horários',
    colunas: [T('Nome', 30), T('Setor'), T('Segunda a sexta', 26), T('Sábado', 16), T('Horas na semana', 15), T('Observação', 30)],
    linhas: lista.map((c) => {
      const j = lerJornada(c.jornadaDetalhe) ?? { semana: [], sabado: [] };
      const sem = minutosDaSemana(j);
      return [c.nome, c.setor, horario(j.semana), horario(j.sabado), sem ? formatarHoras(sem) : null, c.jornada];
    }),
  }];
}

async function aniversarios(): Promise<Aba[]> {
  const lista = (await ativos()).filter((c) => valida(c.nascimento));
  lista.sort((a, b) => a.nascimento!.slice(5).localeCompare(b.nascimento!.slice(5)));
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return [{
    nome: 'Aniversariantes',
    colunas: [T('Mês', 12), T('Dia', 6), T('Nome', 30), T('Setor'), D('Nascimento')],
    linhas: lista.map((c) => [meses[Number(c.nascimento!.slice(5, 7)) - 1], c.nascimento!.slice(8, 10), c.nome, c.setor, d(c.nascimento)]),
  }];
}

async function salarios(): Promise<Aba[]> {
  const hoje = hojeISO();
  const lista = await prisma.colaborador.findMany({
    where: { ativo: true },
    include: { salarios: { orderBy: [{ desde: 'desc' }, { createdAt: 'desc' }] } },
    orderBy: [{ setor: 'asc' }, { nome: 'asc' }],
  });
  return [
    {
      nome: 'Salários atuais',
      colunas: [T('Nome', 30), T('Setor'), T('Cargo'), R('Salário'), D('Desde')],
      linhas: lista.map((c) => {
        const s = c.salarios.find((x) => x.desde <= hoje);
        return [c.nome, c.setor, c.cargo, r(s?.valorCentavos), d(s?.desde)];
      }),
    },
    {
      nome: 'Histórico de salários',
      colunas: [T('Nome', 30), R('Salário'), D('A partir de'), T('Motivo', 30)],
      linhas: lista.flatMap((c) => [...c.salarios].reverse().map((s) => [c.nome, r(s.valorCentavos), d(s.desde), s.motivo])),
    },
  ];
}

async function holerites(mes?: string): Promise<Aba[]> {
  if (mes) {
    const lista = await prisma.colaborador.findMany({
      where: { ativo: true },
      include: { holerites: { where: { competencia: mes } } },
      orderBy: [{ setor: 'asc' }, { nome: 'asc' }],
    });
    return [{
      nome: 'Holerites',
      colunas: [T('Nome', 30), T('Setor'), T('Entregue', 10), D('Entregue em')],
      linhas: lista.map((c) => [c.nome, c.setor, c.holerites[0]?.entregueEm ? 'Sim' : 'Não', d(c.holerites[0]?.entregueEm)]),
    }];
  }
  const todos = await prisma.holerite.findMany({
    include: { colaborador: { select: { nome: true } } },
    orderBy: [{ competencia: 'desc' }],
  });
  return [{
    nome: 'Holerites',
    colunas: [T('Mês', 18), T('Nome', 30), D('Entregue em')],
    linhas: todos.map((h) => [nomeCompetencia(h.competencia), h.colaborador.nome, d(h.entregueEm)]),
  }];
}

async function beneficio(tipo: TipoBeneficio, mes?: string): Promise<Aba[]> {
  const nome = NOME_BENEFICIO[tipo];
  if (mes) {
    const [lista, salvo] = await Promise.all([
      prisma.colaborador.findMany({
        where: { ativo: true, beneficios: { some: { tipo } } },
        include: { beneficios: { where: { tipo } }, recargas: { where: { tipo, competencia: mes } } },
        orderBy: [{ setor: 'asc' }, { nome: 'asc' }],
      }),
      prisma.mesBeneficio.findUnique({ where: { tipo_competencia: { tipo, competencia: mes } } }),
    ]);
    const uteis = salvo?.diasUteis ?? diasUteisDoMes(mes);
    return [{
      nome,
      colunas: [T('Nome', 30), T('Setor'), R('Valor'), T('Por', 6), N('Dias úteis'), N('Dias'), T('Motivo', 28), R('Valor do mês'), D('Carregado em')],
      linhas: lista.map((c) => {
        const b = c.beneficios[0];
        const rc = c.recargas[0];
        const dias = rc?.dias ?? uteis;
        const valor = rc?.carregadoEm && rc.valorCentavos !== null ? rc.valorCentavos : valorDaRecarga(b, dias, uteis);
        return [c.nome, c.setor, r(b.valorCentavos), b.porDia ? 'dia' : 'mês', uteis, dias, rc?.motivo ?? null, r(valor), d(rc?.carregadoEm)];
      }),
    }];
  }
  const [quem, recargas] = await Promise.all([
    prisma.beneficio.findMany({ where: { tipo }, include: { colaborador: { select: { nome: true, setor: true } } } }),
    prisma.recargaBeneficio.findMany({ where: { tipo }, include: { colaborador: { select: { nome: true } } }, orderBy: { competencia: 'desc' } }),
  ]);
  return [
    {
      nome: `${tipo.toUpperCase()} - quem recebe`,
      colunas: [T('Nome', 30), T('Setor'), R('Valor'), T('Por', 6)],
      linhas: quem.map((b) => [b.colaborador.nome, b.colaborador.setor, r(b.valorCentavos), b.porDia ? 'dia' : 'mês']),
    },
    {
      nome: `${tipo.toUpperCase()} - recargas`,
      colunas: [T('Mês', 18), T('Nome', 30), N('Dias'), T('Motivo', 28), R('Valor carregado'), D('Carregado em')],
      linhas: recargas.map((x) => [nomeCompetencia(x.competencia), x.colaborador.nome, x.dias, x.motivo, r(x.valorCentavos), d(x.carregadoEm)]),
    },
  ];
}

async function plano(): Promise<Aba[]> {
  const vidas = await prisma.planoVida.findMany({
    include: { colaborador: { select: { nome: true, setor: true } } },
    orderBy: [{ createdAt: 'asc' }],
  });
  return [{
    nome: 'Plano de saúde',
    colunas: [T('Colaborador', 30), T('Pessoa', 30), T('Parentesco', 12), D('Nascimento'), T('Plano', 20), T('Carteirinha', 20), R('Valor'), R('Desconto'), D('Inclusão'), D('Exclusão'), T('Observação', 30)],
    linhas: vidas.map((v) => [v.colaborador.nome, v.nome ?? v.colaborador.nome, v.parentesco, d(v.nascimento), v.plano, v.carteirinha, r(v.valorCentavos), r(v.descontoCentavos), d(v.inclusao), d(v.exclusao), v.observacao]),
  }];
}

async function metas(mes?: string): Promise<Aba[]> {
  const premios = await prisma.premio.findMany({
    where: mes ? { competencia: mes } : undefined,
    include: { colaborador: { select: { nome: true, setor: true } } },
    orderBy: [{ competencia: 'desc' }, { createdAt: 'asc' }],
  });
  return [{
    nome: 'Metas',
    colunas: [T('Mês', 18), T('Nome', 30), T('Setor'), T('Assinatura', 14), T('Observação', 30), D('Ativada em')],
    linhas: premios.map((p) => [nomeCompetencia(p.competencia), p.colaborador.nome, p.colaborador.setor, p.servico, p.observacao, d(p.ativadoEm)]),
  }];
}

async function freelas(): Promise<Aba[]> {
  const lista = await prisma.freelancer.findMany({
    include: { diarias: { orderBy: { data: 'asc' } } },
    orderBy: { nome: 'asc' },
  });
  return [
    {
      nome: 'Freelancers',
      colunas: [T('Nome', 30), T('Função', 14), T('Telefone', 16), T('PIX', 26), R('Diária'), R('A pagar'), T('Ativo', 7), T('Observação', 30)],
      linhas: lista.map((f) => [
        f.nome, f.funcao, f.telefone, f.pix, r(f.diariaCentavos),
        r(f.diarias.filter((x) => !x.pagoEm).reduce((s, x) => s + x.valorCentavos, 0)),
        f.ativo ? 'Sim' : 'Não', f.observacao,
      ]),
    },
    {
      nome: 'Diárias',
      colunas: [T('Nome', 30), D('Dia'), R('Valor'), T('Observação', 28), D('Pago em')],
      linhas: lista.flatMap((f) => f.diarias.map((x) => [f.nome, d(x.data), r(x.valorCentavos), x.observacao, d(x.pagoEm)])),
    },
  ];
}

async function agenda(mes?: string): Promise<Aba[]> {
  const hoje = hojeISO();
  const itens = await itensDaAgenda(hoje);
  const comp = mes ?? mesDe(hoje);
  const [ano, m] = comp.split('-').map(Number);
  const feitos = new Set(itens.flatMap((i) => i.feitos.map((d) => `${i.id}|${d}`)));
  const linhas: Celula[][] = itens
    .flatMap((i) => ocorrenciasNoMes(i, m, ano).map((data) => ({ i, data })))
    .sort((a, b) => a.data.localeCompare(b.data))
    .map(({ i, data }) => {
      const feito = feitos.has(`${i.id}|${data}`);
      return [d(data), i.titulo, feito ? 'Feito' : data < hoje ? 'Atrasado' : 'A fazer', i.observacao];
    });
  const feriados = feriadosDoAno(ano).filter((f) => Number(f.data.slice(5, 7)) === m);
  return [
    {
      nome: `Agenda ${NOMES_MES[m - 1]}`,
      colunas: [D('Dia'), T('Compromisso', 40), T('Situação', 11), T('Observação', 30)],
      linhas: [...linhas, ...feriados.map((f) => [d(f.data), f.nome, f.facultativo ? 'Ponto facultativo' : 'Feriado nacional', null])]
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    },
    {
      nome: 'Compromissos',
      colunas: [T('Compromisso', 40), T('Repetição', 40), T('Situação', 10), T('Observação', 30)],
      linhas: itens.map((i) => [i.titulo, rotuloFrequencia(i), i.ativo ? 'Ativo' : 'Pausado', i.observacao]),
    },
  ];
}

/* ─── Entrada ─── */

export const TELAS = ['agenda', 'colaboradores', 'horas', 'horarios', 'aniversarios', 'salarios', 'holerites', 'va', 'vt', 'plano', 'metas', 'freelas', 'tudo'] as const;
export type Tela = (typeof TELAS)[number];

/** Monta a planilha da tela. `mes` só vale para as telas que são por mês. */
export async function montarPlanilha(tela: Tela, mesPedido: string | null): Promise<Planilha> {
  const hoje = hojeISO();
  const mes = competenciaValida(mesPedido) ? mesPedido : mesDe(hoje);
  const sufixoMes = ` - ${nomeCompetencia(mes)}`;
  const dia = dataBR(hoje).replace(/\//g, '-');

  switch (tela) {
    case 'agenda': return { arquivo: `Calendário DP${sufixoMes}`, abas: await agenda(mes) };
    case 'colaboradores': return { arquivo: `Colaboradores - ${dia}`, abas: await colaboradores() };
    case 'horas': return { arquivo: `Banco de horas - ${dia}`, abas: await horas() };
    case 'horarios': return { arquivo: `Horários - ${dia}`, abas: await horarios() };
    case 'aniversarios': return { arquivo: 'Aniversariantes', abas: await aniversarios() };
    case 'salarios': return { arquivo: `Salários - ${dia}`, abas: await salarios() };
    case 'holerites': return { arquivo: `Holerites${sufixoMes}`, abas: await holerites(mes) };
    case 'va': return { arquivo: `Vale Alimentação${sufixoMes}`, abas: await beneficio('va', mes) };
    case 'vt': return { arquivo: `Vale Transporte${sufixoMes}`, abas: await beneficio('vt', mes) };
    case 'plano': return { arquivo: `Plano de saúde - ${dia}`, abas: await plano() };
    case 'metas': return { arquivo: `Metas${sufixoMes}`, abas: await metas(mes) };
    case 'freelas': return { arquivo: `Freelance - ${dia}`, abas: await freelas() };
    case 'tudo': {
      // Tudo, com o histórico inteiro dos assuntos que são por mês.
      const partes = await Promise.all([
        agenda(), colaboradores(), horarios(), horas(), salarios(), holerites(),
        beneficio('va'), beneficio('vt'), plano(), metas(), freelas(), aniversarios(),
      ]);
      return { arquivo: `Backup DP AGF Saul - ${dia}`, abas: partes.flat() };
    }
  }
}
