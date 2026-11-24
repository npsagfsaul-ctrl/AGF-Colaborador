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

    const ws = wb.addWorksheet(nome, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = aba.colunas.map((c) => ({ header: c.titulo, width: c.largura ?? 18 }));

    for (const linha of aba.linhas) {
      ws.addRow(
        linha.map((v, i) => {
          if (v === null || v === undefined || v === '') return null;
          if (aba.colunas[i]?.tipo === 'data' && typeof v === 'string') {
            const [a, m, d] = v.split('-').map(Number);
            return new Date(Date.UTC(a, m - 1, d));
          }
          return v;
        }),
      );
    }

    aba.colunas.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      if (c.tipo === 'data') col.numFmt = 'dd/mm/yyyy';
      if (c.tipo === 'dinheiro') col.numFmt = '"R$" #,##0.00';
    });

    const topo = ws.getRow(1);
    topo.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    topo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6D4FD8' } };
    topo.alignment = { vertical: 'middle' };
    topo.height = 20;
    if (aba.colunas.length) {
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: aba.colunas.length } };
    }
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
