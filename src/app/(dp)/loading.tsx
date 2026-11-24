/**
 * Aparece na hora do clique, enquanto a página busca os dados: o menu fica,
 * e o conteúdo mostra blocos cinza no lugar de ficar parado.
 */
export default function Carregando() {
  return (
    <div className="dp-carregando" aria-busy="true" aria-label="Carregando">
      <div className="dp-osso" style={{ width: 220, height: 28, marginBottom: 20 }} />
      <div className="card">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="dp-osso" style={{ height: 18, marginBottom: 14, width: `${90 - i * 8}%` }} />
        ))}
      </div>
    </div>
  );
}
