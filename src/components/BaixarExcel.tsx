/**
 * Baixa a tela em planilha. É um link comum para a rota de exportação: o
 * navegador cuida do download e do nome do arquivo.
 */
export default function BaixarExcel({ tela, mes, rotulo = 'Baixar Excel' }: { tela: string; mes?: string; rotulo?: string }) {
  const href = `/api/exportar/${tela}${mes ? `?mes=${mes}` : ''}`;
  return (
    <a href={href} className="btn btn-outline btn-sm" download>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
      </svg>
      {rotulo}
    </a>
  );
}
