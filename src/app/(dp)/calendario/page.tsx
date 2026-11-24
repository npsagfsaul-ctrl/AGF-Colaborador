import { hojeISO } from '@/lib/datas';
import { itensDaAgenda } from '@/lib/agendaDados';
import Calendario from '@/components/Calendario';
import BaixarExcel from '@/components/BaixarExcel';

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ mes?: string; ano?: string }> }) {
  const hoje = hojeISO();
  const [anoHoje, mesHoje] = hoje.split('-').map(Number);
  const sp = await searchParams;
  const mes = sp.mes ? Math.min(12, Math.max(1, parseInt(sp.mes) || mesHoje)) : mesHoje;
  const ano = sp.ano ? parseInt(sp.ano) || anoHoje : anoHoje;
  const itens = await itensDaAgenda(hoje);
  const comp = `${ano}-${String(mes).padStart(2, '0')}`;

  return (
    <div>
      <div className="dp-titulo">
        <h1 className="page-title">Calendário</h1>
        <div className="dp-direita"><BaixarExcel tela="agenda" mes={comp} /></div>
      </div>
      <Calendario itens={itens} mes={mes} ano={ano} hoje={hoje} />
    </div>
  );
}
