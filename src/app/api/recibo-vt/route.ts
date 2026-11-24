import ExcelJS from 'exceljs';
import { cookies } from 'next/headers';
import { COOKIE, tokenEsperado } from '@/lib/sessao';
import { prisma } from '@/lib/prisma';
import { competenciaValida, hojeISO, mesDe, nomeCompetencia } from '@/lib/datas';
import { diasDoMes, diasPadrao, diasQueTrabalha, ehEstagiario, valorDaRecarga } from '@/lib/beneficio';
import { dinheiroPorExtenso } from '@/lib/extenso';
import { diaDaSemana, feriadosDoAno } from '@/lib/feriados';

export const dynamic = 'force-dynamic';

/** Quem assina como empregador e a cidade, como no recibo que vai ao financeiro. */
const EMPREGADOR = 'Viruel e Souza Ltda';
const CIDADE = 'Londrina';
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const REAL = '"R$" #,##0.00';

/**
 * Recibo de Vale Transporte do mês em .xlsx, no modelo do financeiro: uma
 * aba por pessoa que recebe, já com nome, valor, extenso, dias e passagens.
 */
export async function GET(req: Request) {
  const esperado = await tokenEsperado();
  if (!esperado || (await cookies()).get(COOKIE)?.value !== esperado) {
    return new Response('Entre de novo no site.', { status: 401 });
  }

  const mes = new URL(req.url).searchParams.get('mes');
  const comp = competenciaValida(mes) ? mes : mesDe(hojeISO());
  const [a, m] = comp.split('-');
  const ultimo = new Date(Date.UTC(Number(a), Number(m), 0)).getUTCDate();

  const [todos, salvo] = await Promise.all([
    prisma.colaborador.findMany({
      where: { ativo: true, beneficios: { some: { tipo: 'vt' } } },
      include: { beneficios: { where: { tipo: 'vt' } }, recargas: { where: { tipo: 'vt', competencia: comp } } },
      orderBy: { nome: 'asc' },
    }),
    prisma.mesBeneficio.findUnique({ where: { tipo_competencia: { tipo: 'vt', competencia: comp } } }),
  ]);
  const lista = todos.filter((c) => !ehEstagiario(c));
  if (lista.length === 0) return new Response('Ninguém recebe Vale Transporte.', { status: 404 });

  const doMes = diasDoMes(comp);
  const uteis = salvo?.diasUteis ?? doMes.semana;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'DP AGF Saul';
  wb.created = new Date();
  const usados = new Set<string>();

  for (const c of lista) {
    const b = c.beneficios[0];
    const r = c.recargas[0];
    const padrao = diasPadrao(diasQueTrabalha(c.jornadaDetalhe), uteis, doMes.sabados);
    const dias = r?.dias ?? padrao;
    const valor = r?.carregadoEm && r.valorCentavos !== null ? r.valorCentavos : valorDaRecarga(b, dias, padrao);
    const nome = c.nome.toUpperCase();

    let aba = c.nome.replace(/[\\/?*[\]:]/g, '-').slice(0, 31);
    for (let i = 2; usados.has(aba); i++) aba = `${c.nome.slice(0, 28)} ${i}`;
    usados.add(aba);

    const ws = wb.addWorksheet(aba, {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    ws.properties.defaultRowHeight = 18;
    ws.columns = [{ width: 16 }, { width: 16 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 4 }, { width: 42 }, { width: 14 }];

    const fino = { style: 'thin' as const };
    const caixa = { top: fino, left: fino, bottom: fino, right: fino };
    const poe = (ref: string, v: ExcelJS.CellValue, estilo: Partial<ExcelJS.Style> = {}) => {
      const cel = ws.getCell(ref);
      cel.value = v;
      Object.assign(cel, estilo);
      return cel;
    };
    const junta = (faixa: string) => ws.mergeCells(faixa);

    // Cabeçalho
    junta('A1:A2');
    poe('A1', 'AGF Saul', { font: { bold: true, size: 13, color: { argb: 'FF1F3C88' } }, alignment: { vertical: 'middle', horizontal: 'center' } });
    junta('B1:E1');
    poe('B1', 'Recibo de Vale Transporte', { font: { bold: true, size: 12 }, alignment: { horizontal: 'center' } });
    junta('B2:E2');
    poe('B2', nome, { alignment: { horizontal: 'center' } });

    // Linhas de dados
    poe('A3', 'Valor');
    poe('B3', valor / 100, { numFmt: REAL, font: { bold: true } });
    junta('C3:E3');
    poe('C3', dinheiroPorExtenso(valor).toUpperCase(), { alignment: { shrinkToFit: true } });
    poe('A4', 'Empregador');
    junta('B4:E4');
    poe('B4', EMPREGADOR);
    poe('A5', 'Empregado');
    junta('B5:E5');
    poe('B5', nome);
    poe('A6', 'Referente', { alignment: { vertical: 'middle' } });
    junta('B6:E6');
    poe('B6', `Vale Transporte de 01.${m}.${a} À ${ultimo}.${m}.${a}.`, { alignment: { vertical: 'middle' } });
    ws.getRow(6).height = 30;

    // Declaração e assinatura
    junta('A7:E7');
    poe('A7', 'Declaro para devidos fins que recebi da empresa a quantidade de vales transporte');
    junta('A8:E8');
    poe('A8', 'declarado acima, para fins de locomoção entre minha residência e o serviço e vice-versa.');
    junta('A9:E9');
    junta('A10:E10');
    poe('A10', 'Sendo verdade firmo o presente', { alignment: { indent: 3 } });
    junta('A11:E11');
    poe('A11', `${CIDADE}, 01 de ${MESES[Number(m) - 1]} de ${a}`, { alignment: { horizontal: 'right', indent: 3 } });
    junta('A12:E12');
    ws.getRow(12).height = 26;
    junta('B13:C13');
    poe('B13', nome, { alignment: { horizontal: 'center' }, border: { top: fino } });

    // Moldura: cada linha da tabela com borda, como no modelo.
    for (let l = 1; l <= 13; l++) {
      for (let col = 1; col <= 5; col++) {
        const cel = ws.getRow(l).getCell(col);
        const borda: Partial<ExcelJS.Borders> = { left: col === 1 ? fino : undefined, right: col === 5 ? fino : undefined };
        if (l <= 8) Object.assign(borda, caixa);
        if (l === 13) borda.bottom = fino;
        if (l === 13 && (col === 2 || col === 3)) borda.top = fino;
        cel.border = borda;
      }
    }
    // Linha mesclada de A a E guarda uma borda só (a da primeira célula):
    // precisa ter os dois lados juntos.
    for (let l = 9; l <= 12; l++) ws.getCell(`A${l}`).border = { left: fino, right: fino };

    // Ao lado: a conta, linha por linha e com fórmula, para o financeiro conferir.
    const quando = diasQueTrabalha(c.jornadaDetalhe);
    const feriados = feriadosDoAno(Number(a))
      .filter((f) => f.data.startsWith(comp) && !f.facultativo)
      .filter((f) => {
        const s = diaDaSemana(f.data);
        return (s >= 1 && s <= 5 && quando.semana) || (s === 6 && quando.sabado);
      })
      .map((f) => `${f.data.slice(8)}/${m} ${f.nome}`);
    const titulo = { font: { bold: true } };
    const conta = (l: number, rotulo: string, v: ExcelJS.CellValue, estilo: Partial<ExcelJS.Style> = {}) => {
      poe(`G${l}`, rotulo, { border: caixa, ...(estilo.font ? { font: estilo.font } : {}) });
      poe(`H${l}`, v, { border: caixa, alignment: { horizontal: 'right' }, ...estilo });
    };
    junta('G1:H1');
    poe('G1', `Como foi calculado — ${nomeCompetencia(comp)}`, { ...titulo, alignment: { horizontal: 'center' }, border: caixa });
    conta(2, salvo ? 'Segunda a sexta no mês (ajustado à mão)' : 'Segunda a sexta no mês, sem feriados', quando.semana ? uteis : 0);
    conta(3, quando.sabado ? 'Sábados no mês (trabalha sábado)' : 'Sábados (não trabalha sábado)', quando.sabado ? doMes.sabados : 0);
    conta(4, 'Dias do mês', { formula: 'H2+H3', result: padrao });
    conta(5, r?.motivo ? `Descontos (${r.motivo})` : 'Descontos (faltas, férias, atestado)', padrao - dias);
    conta(6, 'Dias pagos', { formula: 'H4-H5', result: dias }, titulo);
    let total: ExcelJS.CellValue;
    if (b.porDia) {
      conta(7, b.vezesPorDia === 2 ? 'Passagens por dia (ida e volta)' : 'Passagens por dia', b.vezesPorDia);
      conta(8, 'Passagens no mês', { formula: 'H6*H7', result: dias * b.vezesPorDia });
      conta(9, 'Valor da passagem', b.valorCentavos / 100, { numFmt: REAL });
      total = { formula: 'H8*H9', result: valor / 100 };
      conta(10, 'Total (passagens × valor)', total, { numFmt: REAL, font: { bold: true } });
    } else {
      conta(7, 'Valor do mês cheio', b.valorCentavos / 100, { numFmt: REAL });
      total = { formula: 'IF(H6>=H4,H7,ROUND(H7*H6/H4,2))', result: valor / 100 };
      conta(8, 'Total (proporcional aos dias pagos)', total, { numFmt: REAL, font: { bold: true } });
    }
    if (feriados.length) {
      junta('G12:H12');
      poe('G12', `Feriados fora da conta: ${feriados.join(', ')}`, { font: { italic: true, size: 9 }, alignment: { wrapText: true, vertical: 'top' } });
      ws.getRow(12).height = 30;
    }
    // O valor do recibo puxa o total da conta — a não ser que o valor já
    // carregado seja outro (passagem mudou depois): aí vale o que foi pago.
    const conferido = valorDaRecarga(b, dias, padrao) === valor;
    if (conferido) ws.getCell('B3').value = { formula: b.porDia ? 'H10' : 'H8', result: valor / 100 };

    ws.pageSetup.printArea = 'A1:H13';
  }

  const buffer = await wb.xlsx.writeBuffer();
  const arquivo = `Recibo VT ${nomeCompetencia(comp)}.xlsx`;
  const ascii = arquivo.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w .()-]/g, '_');

  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(arquivo)}`,
      'Cache-Control': 'no-store',
    },
  });
}
