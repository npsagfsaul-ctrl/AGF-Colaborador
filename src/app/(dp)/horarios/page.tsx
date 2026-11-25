import { porNome } from '@/lib/ordem';
import { prisma } from '@/lib/prisma';
import { lerJornada } from '@/lib/jornada';
import ListaHorarios from '@/components/ListaHorarios';
import BaixarExcel from '@/components/BaixarExcel';

export default async function HorariosPage() {
  const colaboradores = await prisma.colaborador.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, setor: true, jornada: true, jornadaDetalhe: true },
    orderBy: { nome: 'asc' },
  });
  colaboradores.sort(porNome);

  return (
    <div>
      <div className="dp-titulo">
        <h1 className="page-title">Horários</h1>
        <div className="dp-direita"><BaixarExcel tela="horarios" /></div>
      </div>
      <ListaHorarios
        linhas={colaboradores.map((c) => ({
          id: c.id,
          nome: c.nome,
          setor: c.setor,
          nota: c.jornada,
          jornada: lerJornada(c.jornadaDetalhe) ?? { semana: [], sabado: [] },
        }))}
      />
    </div>
  );
}
