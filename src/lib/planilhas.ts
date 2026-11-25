import { prisma } from './prisma';
import {
  competenciaValida,
  dataBR,
  hojeISO,
  mesDe,
  nomeCompetencia,
  situacaoAso,
  situacaoFerias,
  valida,
} from './datas';
import { formatarHoras, jaEstaNoRelatorio, saldoDe } from './horas';
import { lerJornada, minutosDaSemana, type Periodo } from './jornada';
import { descontoFolhaVA, descontoFolhaVT, diasDoMes, diasPadrao, diasQueTrabalha, diasVA, foraDoBeneficio, NOME_BENEFICIO, salarioNoMes, valorDaRecarga, type TipoBeneficio } from './beneficio';
import { NOMES_MES, ocorrenciasNoMes, rotuloFrequencia } from './agenda';
import { feriadosDoAno } from './feriados';
import { itensDaAgenda } from './agendaDados';
import { faturaDoMes } from './planoDados';

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
/** Fórmula do Excel com o resultado já calculado (o Excel mostra o resultado e refaz a conta se mudarem os números). */
export interface Formula { formula: string; valor: number }
export type Celula = string | number | null | Formula;
/**
 * `titulo` é a linha de cima da planilha; sem ele, vale o nome da aba.
 * `notas` vão embaixo da tabela, uma por linha — a primeira sai em negrito.
 */
export interface Aba {
  nome: string;
  titulo?: string;
  colunas: Coluna[];
  linhas: Celula[][];
  notas?: string[];
  /** Cor de fundo por linha (argb), no lugar da zebra. Ex.: uma cor por família. */
  cores?: (string | null)[];
}
export interface Planilha { arquivo: string; abas: Aba[] }

/** "2026-11" + 1 → "2026-12". */
function somaMesCompetencia(comp: string, n: number): string {
  const [a, m] = comp.split('-').map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

const T = (titulo: string, largura = 18): Coluna => ({ titulo, largura });
const D = (titulo: string): Coluna => ({ titulo, tipo: 'data', largura: 13 });
const R = (titulo: string): Coluna => ({ titulo, tipo: 'dinheiro', largura: 14 });
const N = (titulo: string): Coluna => ({ titulo, tipo: 'numero', largura: 10 });

/** Data "aaaa-mm-dd" fica como está; a rota converte. Inválida vira vazio. */
const d = (s: string | null | undefined) => (valida(s) ? s : null);
/** Centavos → reais. */
const r = (c: number | null | undefined) => (c === null || c === undefined ? null : c / 100);

async function ativos() {
  return prisma.colaborador.findMany({ where: { ativo: true, foraDosProcessos: false }, orderBy: { nome: 'asc' } });
}

/* ─── Cada tela ─── */

async function colaboradores(): Promise<Aba[]> {
  const hoje = hojeISO();
  const lista = await prisma.colaborador.findMany({
    include: { ferias: { select: { inicio: true, fim: true, observacao: true } } },
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
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
    where: { ativo: true, foraDosProcessos: false },
    include: { lancamentos: { orderBy: { data: 'asc' } } },
    orderBy: { nome: 'asc' },
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
  // Aniversário é de todo mundo: quem está fora dos processos e os freelas também.
  const [gente, freelas] = await Promise.all([
    prisma.colaborador.findMany({ where: { ativo: true }, select: { nome: true, setor: true, nascimento: true } }),
    prisma.freelancer.findMany({ where: { ativo: true }, select: { nome: true, funcao: true, nascimento: true } }),
  ]);
  const lista = [
    ...gente,
    ...freelas.map((f) => ({ nome: f.nome, setor: `Freela${f.funcao ? ` · ${f.funcao}` : ''}`, nascimento: f.nascimento })),
  ].filter((c) => valida(c.nascimento));
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
    where: { ativo: true, foraDosProcessos: false },
    include: { salarios: { orderBy: [{ desde: 'desc' }, { createdAt: 'desc' }] } },
    orderBy: { nome: 'asc' },
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
      where: { ativo: true, foraDosProcessos: false },
      include: { holerites: { where: { competencia: mes } } },
      orderBy: { nome: 'asc' },
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

/** "dia", "2 por dia", "mês". */
function por(b: { porDia: boolean; vezesPorDia: number }) {
  if (!b.porDia) return 'mês';
  return b.vezesPorDia > 1 ? `${b.vezesPorDia} por dia` : 'dia';
}

async function beneficio(tipo: TipoBeneficio, mes?: string): Promise<Aba[]> {
  const nome = NOME_BENEFICIO[tipo];
  if (mes) {
    const [lista, salvo] = await Promise.all([
      prisma.colaborador.findMany({
        where: { ativo: true, foraDosProcessos: false, beneficios: { some: { tipo } } },
        include: {
          beneficios: { where: { tipo } },
          recargas: { where: { tipo, competencia: mes } },
          salarios: { select: { valorCentavos: true, desde: true } },
        },
        orderBy: { nome: 'asc' },
      }),
      prisma.mesBeneficio.findUnique({ where: { tipo_competencia: { tipo, competencia: mes } } }),
    ]);
    const doMes = diasDoMes(mes);
    const uteis = salvo?.diasUteis ?? doMes.semana;
    if (tipo === 'va') {
      // No jeito da planilha do DP: dias úteis + meio dia por sábado − descontos.
      const pessoas = lista.filter((c) => !foraDoBeneficio(c));
      // Colunas: A nome, B setor, C dias úteis, D sábados, E descontar, F dias do mês,
      // G descrição, H valor unit., I valor do mês, J desc. folha, K carregado em.
      // F, I, J e o total vão como fórmula: quem abre vê a conta clicando na célula.
      const PRIMEIRA = 3; // linha 1 = título, linha 2 = cabeçalho
      let somaValor = 0;
      let somaFolha = 0;
      const linhas: Celula[][] = pessoas.map((c, i) => {
        const n = PRIMEIRA + i;
        const b = c.beneficios[0];
        const rc = c.recargas[0];
        const dias = diasVA(uteis, rc);
        const valor = rc?.carregadoEm && rc.valorCentavos !== null ? rc.valorCentavos : valorDaRecarga(b, dias, uteis);
        // Já carregado: o valor do dia daquela época (antes de um dissídio, por exemplo).
        const unit = rc?.carregadoEm && rc.valorCentavos !== null && b.porDia && dias > 0 ? Math.round(rc.valorCentavos / dias) : b.valorCentavos;
        const folha = descontoFolhaVA(valor);
        somaValor += valor;
        somaFolha += folha;
        const porDia = b.porDia;
        return [
          c.nome, c.setor, uteis, rc?.sabados ?? null, rc?.descontar ?? null,
          { formula: `C${n}+D${n}*0.5-E${n}`, valor: dias },
          rc?.motivo ?? null,
          r(unit),
          porDia ? { formula: `ROUND(F${n}*H${n},2)`, valor: valor / 100 } : r(valor),
          { formula: `ROUND(I${n}*20%,2)`, valor: folha / 100 },
          d(rc?.carregadoEm),
        ];
      });
      const ultima = PRIMEIRA + linhas.length - 1;
      linhas.push(['Total', null, null, null, null, null, null, null,
        { formula: `SUM(I${PRIMEIRA}:I${ultima})`, valor: somaValor / 100 },
        { formula: `SUM(J${PRIMEIRA}:J${ultima})`, valor: somaFolha / 100 },
        null]);
      const [anoM, mesM] = mes.split('-').map(Number);
      const feriados = feriadosDoAno(anoM)
        .filter((f) => f.data.startsWith(mes) && !f.facultativo)
        .filter((f) => { const s = new Date(`${f.data}T12:00:00Z`).getUTCDay(); return s >= 1 && s <= 5; })
        .map((f) => `${f.data.slice(8)}/${String(mesM).padStart(2, '0')} ${f.nome}`);
      const notas = [
        'Como é calculado',
        `Dias úteis: segunda a sexta do mês, sem os feriados nacionais = ${uteis} dias${feriados.length ? ` (fora: ${feriados.join(', ')})` : ''}.`,
        'Sábados: cada sábado trabalhado no período anterior soma meio dia (0,5).',
        'Descontar: falta ou atestado = 1 dia; declaração ou dia com menos de 5 horas trabalhadas = meio dia (0,5).',
        'Dias do mês = Dias úteis + Sábados × 0,5 − Descontar.',
        'Valor do mês = Dias do mês × Valor unit.   Desc. folha = 20% do Valor do mês.',
      ];
      return [{
        nome: `VA - ${nomeCompetencia(mes)}`,
        titulo: `Vale Alimentação — ${nomeCompetencia(mes)} — ${uteis} dias úteis`,
        colunas: [T('Nome completo', 34), T('Setor'), N('Dias úteis'), N('Sábados (½ dia cada)'), N('Descontar'), N('Dias do mês'), T('Descrição', 40), R('Valor unit.'), R('Valor do mês'), R('Desc. folha 20%'), D('Carregado em')],
        linhas,
        notas,
      }];
    }
    // VT — colunas: A nome, B setor, C seg a sex, D sábados, E dias do mês, F descontar,
    // G dias pagos, H passagens/dia, I passagens, J valor da passagem, K valor do mês,
    // L salário, M desc. folha 6%, N motivo, O carregado em. E, G, I, K, M e o total são fórmula.
    const PRIMEIRA = 3;
    let somaValor = 0;
    let somaFolha = 0;
    const pessoas = lista.filter((c) => !foraDoBeneficio(c));
    const linhas: Celula[][] = pessoas.map((c, i) => {
      const n = PRIMEIRA + i;
      const b = c.beneficios[0];
      const rc = c.recargas[0];
      const quando = diasQueTrabalha(c.jornadaDetalhe);
      const semana = quando.semana ? uteis : 0;
      const sabados = quando.sabado ? doMes.sabados : 0;
      const padrao = diasPadrao(quando, uteis, doMes.sabados);
      const dias = rc?.dias ?? padrao;
      const valor = rc?.carregadoEm && rc.valorCentavos !== null ? rc.valorCentavos : valorDaRecarga(b, dias, padrao);
      const salario = salarioNoMes(c.salarios, mes);
      const folha = descontoFolhaVT(salario, valor);
      somaValor += valor;
      somaFolha += folha ?? 0;
      const passagens = dias * b.vezesPorDia;
      // Já carregado com outro preço (a passagem subiu depois): mostra o preço daquela época.
      const unit = b.porDia && passagens > 0 && rc?.carregadoEm && rc.valorCentavos !== null ? Math.round(rc.valorCentavos / passagens) : b.valorCentavos;
      return [
        c.nome, c.setor, semana, sabados,
        { formula: `C${n}+D${n}`, valor: padrao },
        padrao - dias,
        { formula: `E${n}-F${n}`, valor: dias },
        b.porDia ? b.vezesPorDia : null,
        b.porDia ? { formula: `G${n}*H${n}`, valor: passagens } : null,
        r(unit),
        b.porDia
          ? { formula: `ROUND(I${n}*J${n},2)`, valor: valor / 100 }
          : { formula: `IF(G${n}>=E${n},J${n},ROUND(J${n}*G${n}/E${n},2))`, valor: valor / 100 },
        r(salario),
        folha === null ? null : { formula: `ROUND(MIN(L${n}*6%,K${n}),2)`, valor: folha / 100 },
        rc?.motivo ?? null,
        d(rc?.carregadoEm),
      ];
    });
    const ultima = PRIMEIRA + linhas.length - 1;
    linhas.push(['Total', null, null, null, null, null, null, null, null, null,
      { formula: `SUM(K${PRIMEIRA}:K${ultima})`, valor: somaValor / 100 }, null,
      { formula: `SUM(M${PRIMEIRA}:M${ultima})`, valor: somaFolha / 100 }, null, null]);
    const [anoM, mesM] = mes.split('-').map(Number);
    const feriados = feriadosDoAno(anoM)
      .filter((f) => f.data.startsWith(mes) && !f.facultativo)
      .filter((f) => { const s = new Date(`${f.data}T12:00:00Z`).getUTCDay(); return s >= 1 && s <= 6; })
      .map((f) => `${f.data.slice(8)}/${String(mesM).padStart(2, '0')} ${f.nome}`);
    return [{
      nome: `VT - ${nomeCompetencia(mes)}`,
      titulo: `Vale Transporte — ${nomeCompetencia(mes)} — ${uteis} dias úteis`,
      colunas: [T('Nome completo', 34), T('Setor'), N('Seg a sex'), N('Sábados'), N('Dias do mês'), N('Descontar'), N('Dias pagos'), N('Passagens por dia'), N('Passagens'), R('Valor da passagem'), R('Valor do mês'), R('Salário'), R('Desc. folha 6%'), T('Motivo', 30), D('Carregado em')],
      linhas,
      notas: [
        'Como é calculado',
        `Seg a sex: dias de segunda a sexta do mês, sem os feriados nacionais = ${uteis} dias${feriados.length ? ` (fora: ${feriados.join(', ')})` : ''}.`,
        `Sábados: os ${doMes.sabados} sábados do mês, só para quem tem horário de sábado na tela Horários.`,
        'Descontar: dias sem ir ao trabalho (falta, férias, atestado).',
        'Dias pagos = Dias do mês − Descontar.   Passagens = Dias pagos × Passagens por dia (ida e volta = 2).',
        'Valor do mês = Passagens × Valor da passagem.',
        'Desc. folha = 6% do salário-base, sem passar do Valor do mês (Lei 7.418/85). Em branco = salário não cadastrado.',
      ],
    }];
  }
  const [quem, recargas] = await Promise.all([
    prisma.beneficio.findMany({ where: { tipo }, include: { colaborador: { select: { nome: true, setor: true, cargo: true, jornada: true, observacao: true } } } }),
    prisma.recargaBeneficio.findMany({ where: { tipo }, include: { colaborador: { select: { nome: true } } }, orderBy: { competencia: 'desc' } }),
  ]);
  return [
    {
      nome: `${tipo.toUpperCase()} - quem recebe`,
      colunas: [T('Nome', 30), T('Setor'), R('Valor'), T('Por', 12)],
      linhas: quem.filter((b) => !foraDoBeneficio(b.colaborador)).map((b) => [b.colaborador.nome, b.colaborador.setor, r(b.valorCentavos), por(b)]),
    },
    {
      nome: `${tipo.toUpperCase()} - recargas`,
      colunas: [T('Mês', 18), T('Nome', 30), N('Dias'), T('Motivo', 28), R('Valor carregado'), D('Carregado em')],
      linhas: recargas.map((x) => [nomeCompetencia(x.competencia), x.colaborador.nome, x.dias, x.motivo, r(x.valorCentavos), d(x.carregadoEm)]),
    },
  ];
}

/** Uma cor clara por família, alternando. */
const CORES_FAMILIA = ['FFE0F2FE', 'FFFCE7F3', 'FFDCFCE7', 'FFFEF3C7', 'FFE0E7FF', 'FFFFEDD5'];

/**
 * Fatura do plano no mês, no jeito da planilha "Hospitalar": uma linha por
 * pessoa, o titular e embaixo os dependentes, cada família numa cor. A
 * empresa paga o titular; o colaborador paga dependentes e consultas/exames,
 * na folha do mês seguinte.
 */
async function faturaPlano(mes: string): Promise<Aba> {
  const familias = await faturaDoMes(mes);
  const P = 3;
  const corpo: Celula[][] = [];
  const cores: (string | null)[] = [];
  familias.forEach((l, i) => {
    for (const p of l.pessoas) {
      const n = P + corpo.length;
      const titular = p.vidaId === null;
      corpo.push([
        p.nome,
        p.parentesco,
        r(p.mensalidade),
        r(p.consultas) || null,
        titular ? { formula: `C${n}`, valor: p.mensalidade / 100 } : null,
        titular
          ? { formula: `D${n}`, valor: p.consultas / 100 }
          : { formula: `C${n}+D${n}`, valor: (p.mensalidade + p.consultas) / 100 },
        titular ? l.observacao || null : null,
        titular ? d(l.lancadoEm) : null,
      ]);
      cores.push(CORES_FAMILIA[i % CORES_FAMILIA.length]);
    }
  });
  const u = P + corpo.length - 1;
  const soma = (col: string, v: number) => ({ formula: `SUM(${col}${P}:${col}${u})`, valor: v / 100 });
  const pessoas = familias.flatMap((l) => l.pessoas);
  const mensalidades = pessoas.reduce((s, p) => s + p.mensalidade, 0);
  const consultas = pessoas.reduce((s, p) => s + p.consultas, 0);
  const empresa = familias.reduce((s, l) => s + l.titular, 0);
  const desconto = mensalidades - empresa + consultas;
  corpo.push(['Total', null, soma('C', mensalidades), soma('D', consultas), soma('E', empresa), soma('F', desconto), null, null]);
  const t = P + corpo.length - 1;
  corpo.push(['Total da fatura (empresa + colaboradores)', null, null, null, null,
    { formula: `E${t}+F${t}`, valor: (empresa + desconto) / 100 }, null, null]);
  const folha = nomeCompetencia(somaMesCompetencia(mes, 1));
  return {
    nome: `Plano - ${nomeCompetencia(mes)}`.slice(0, 31),
    titulo: `Plano de saúde Hospitalar — fatura de ${nomeCompetencia(mes)}`,
    colunas: [T('Colaborador', 30), T('Parentesco', 13), R('Mensalidade'), { ...R('Consultas e exames'), largura: 16 }, R('Empresa paga'), R('Desconto em folha'), T('Descrição', 30), D('Lançado em')],
    linhas: corpo,
    cores,
    notas: [
      'Como é calculado',
      'Cada família numa cor: o titular e, embaixo, os dependentes.',
      'Mensalidade do titular: a empresa paga 100% (todos são representantes).',
      'Mensalidade dos dependentes: paga pelo colaborador.',
      'Consultas e exames (coparticipação): pagos pelo colaborador, só quando usou, seja do titular ou do dependente.',
      `Desconto em folha = Mensalidade dos dependentes + Consultas e exames da família, lançado na folha de ${folha}.`,
      'Total da fatura = Empresa paga + Desconto em folha de todos.',
    ],
  };
}

async function plano(mes?: string): Promise<Aba[]> {
  const vidas = await prisma.planoVida.findMany({
    include: { colaborador: { select: { nome: true, setor: true } } },
    orderBy: [{ createdAt: 'asc' }],
  });
  return [{
    nome: 'Plano - vidas',
    titulo: 'Plano de saúde — vidas cadastradas',
    colunas: [T('Colaborador', 30), T('Pessoa', 30), T('Parentesco', 12), D('Nascimento'), T('Plano', 20), T('Carteirinha', 20), R('Mensalidade'), D('Inclusão'), D('Exclusão'), T('Observação', 30)],
    linhas: vidas.map((v) => [v.colaborador.nome, v.nome ?? v.colaborador.nome, v.parentesco, d(v.nascimento), v.plano, v.carteirinha, r(v.valorCentavos), d(v.inclusao), d(v.exclusao), v.observacao]),
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
    case 'plano': return { arquivo: `Plano de saúde${sufixoMes}`, abas: [await faturaPlano(mes), ...(await plano())] };
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
