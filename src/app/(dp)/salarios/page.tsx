import { prisma } from '@/lib/prisma';
import { hojeISO } from '@/lib/datas';
import ListaSalarios from '@/components/ListaSalarios';
import BaixarExcel from '@/components/BaixarExcel';

export default async function SalariosPage() {
  const hoje = hojeISO();
  const colaboradores = await prisma.colaborador.findMany({
    where: { ativo: true },
    include: { salarios: { orderBy: [{ desde: 'desc' }, { createdAt: 'desc' }] } },
    orderBy: [{ setor: 'asc' }, { nome: 'asc' }],
  });

  return (
    <div>
      <div className="dp-titulo">
        <h1 className="page-title">Salários</h1>
        <div className="dp-direita"><BaixarExcel tela="salarios" /></div>
      </div>
      <ListaSalarios
        hoje={hoje}
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
