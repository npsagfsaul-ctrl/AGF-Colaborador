import ExcelJS from 'exceljs';
import { cookies } from 'next/headers';
import { COOKIE, tokenEsperado } from '@/lib/sessao';
import { montarPlanilha, TELAS, type Tela } from '@/lib/planilhas';

export const dynamic = 'force-dynamic';

/**
 * Baixa uma tela em .xlsx, para guardar de backup na pasta do DP.
 *
 * O middleware já exige a senha; a conferência repetida aqui é porque esta
 * rota entrega dado pessoal de todo mundo de uma vez.
 */
export async function GET(req: Request, { params }: { params: Promise<{ tela: string }> }) {
  const esperado = await tokenEsperado();
  if (!esperado || (await cookies()).get(COOKIE)?.value !== esperado) {
    return new Response('Entre de novo no site.', { status: 401 });
  }

  const { tela } = await params;
  if (!TELAS.includes(tela as Tela)) return new Response('Tela desconhecida.', { status: 404 });

  const mes = new URL(req.url).searchParams.get('mes');
  const planilha = await montarPlanilha(tela as Tela, mes);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'DP AGF Saul';
  wb.created = new Date();

  const usados = new Set<string>();
  for (const aba of planilha.abas) {
    // Excel aceita até 31 caracteres e não aceita repetir nome de aba.
    let nome = aba.nome.replace(/[\\/?*[\]:]/g, '-').slice(0, 31);
    for (let i = 2; usados.has(nome); i++) nome = `${aba.nome.slice(0, 28)} ${i}`;
    usados.add(nome);

    // Linha 1: título da planilha. Linha 2: cabeçalho. Depois, os dados.
    // Vai para a gerência: tem de abrir já com cara de relatório.
    const n = aba.colunas.length;
    const ws = wb.addWorksheet(nome, {
      views: [{ state: 'frozen', ySplit: 2 }],
      pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:2' },
    });
    ws.columns = aba.colunas.map((c) => ({ width: c.largura ?? 18 }));
    if (n === 0) continue;

    const ROXO = 'FF6D4FD8';
    const linhaFina = { style: 'thin' as const, color: { argb: 'FFD9D6E8' } };
    const borda = { top: linhaFina, left: linhaFina, bottom: linhaFina, right: linhaFina };
    // Nome e descrição (colunas largas de texto) ficam à esquerda; o resto, no centro.
    const aEsquerda = aba.colunas.map((c) => (c.tipo ?? 'texto') === 'texto' && (c.largura ?? 18) >= 26);

    ws.mergeCells(1, 1, 1, n);
    const titulo = ws.getCell(1, 1);
    titulo.value = (aba.titulo ?? aba.nome).toUpperCase();
    titulo.font = { bold: true, size: 13, color: { argb: ROXO } };
    titulo.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 26;

    const cabecalho = ws.getRow(2);
    cabecalho.values = aba.colunas.map((c) => c.titulo);
    cabecalho.height = 32;
    cabecalho.eachCell((cel) => {
      cel.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROXO } };
      cel.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cel.border = borda;
    });

    aba.linhas.forEach((linha, idx) => {
      const row = ws.addRow(
        linha.map((v, i) => {
          if (v === null || v === undefined || v === '') return null;
          if (aba.colunas[i]?.tipo === 'data' && typeof v === 'string') {
            const [a, m, d] = v.split('-').map(Number);
            return new Date(Date.UTC(a, m - 1, d));
          }
          return v;
        }),
      );
      const total = linha[0] === 'Total';
      for (let i = 1; i <= n; i++) {
        const cel = row.getCell(i);
        const c = aba.colunas[i - 1];
        if (c.tipo === 'data') cel.numFmt = 'dd/mm/yyyy';
        if (c.tipo === 'dinheiro') cel.numFmt = '"R$" #,##0.00';
        cel.alignment = { horizontal: aEsquerda[i - 1] ? 'left' : 'center', vertical: 'middle', wrapText: aEsquerda[i - 1] };
        cel.border = total ? { ...borda, top: { style: 'medium', color: { argb: ROXO } } } : borda;
        if (total) {
          cel.font = { bold: true };
          cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } };
        } else if (idx % 2 === 1) {
          cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F5FF' } };
        }
      }
    });

    const ultimaDado = 2 + aba.linhas.filter((l) => l[0] !== 'Total').length;
    ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: Math.max(2, ultimaDado), column: n } };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const arquivo = `${planilha.arquivo}.xlsx`;
  const ascii = arquivo.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w .()-]/g, '_');

  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(arquivo)}`,
      'Cache-Control': 'no-store',
    },
  });
}
