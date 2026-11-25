import { porNome } from '@/lib/ordem';
import { prisma } from '@/lib/prisma';
import { hojeISO } from '@/lib/datas';
import { diaDoAdiantamento, enesimoDiaUtilSalario } from '@/lib/pagamentos';
import ListaSalarios from '@/components/ListaSalarios';
import BaixarExcel from '@/components/BaixarExcel';

export default async function SalariosPage() {
  const hoje = hojeISO();
  const colaboradores = await prisma.colaborador.findMany({
    where: { ativo: true, foraDosProcessos: false },
    include: { salarios: { orderBy: [{ desde: 'desc' }, { createdAt: 'desc' }] } },
    orderBy: { nome: 'asc' },
  });
  colaboradores.sort(porNome);
  const [ano, mes] = hoje.split('-').map(Number);
  const quinto = enesimoDiaUtilSalario(ano, mes, 5);
  const pagamentos = {
    adiantamento: diaDoAdiantamento(ano, mes),
    mensal: quinto.pagar,
    mensalNoSabado: quinto.legal !== quinto.pagar ? quinto.legal : null,
    mesDoMensal: mes === 1 ? 12 : mes - 1,
  };

  return (
    <div>
      <div className="dp-titulo">
        <h1 className="page-title">Salários</h1>
        <div className="dp-direita"><BaixarExcel tela="salarios" /></div>
      </div>
      <ListaSalarios
        hoje={hoje}
        pagamentos={pagamentos}
        linhas={colaboradores.map((c) => ({
          id: c.id,
          nome: c.nome,
          setor: c.setor,
          cargo: c.cargo,
          historico: c.salarios.map((s) => ({ id: s.id, valorCentavos: s.valorCentavos, desde: s.desde, motivo: s.motivo })),
        }))}
      />
    </div>
  );
}
