const CORES = ['#6d4fd8', '#3b82f6', '#0ea5a4', '#e0762f', '#d6457a', '#5b8c2a', '#8a5cf6', '#c2410c'];

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter((p) => !/^(da|de|do|das|dos|e)$/i.test(p));
  if (partes.length === 0) return '?';
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

/** A mesma pessoa sempre com a mesma cor: a cor sai do nome. */
function corDe(nome: string): string {
  let h = 0;
  for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CORES[h % CORES.length];
}

export default function Avatar({ nome, tamanho = 32, anel = false }: { nome: string; tamanho?: number; anel?: boolean }) {
  const circulo = (
    <div
      className="dp-avatar"
      style={{ width: tamanho, height: tamanho, background: corDe(nome), fontSize: tamanho * 0.38 }}
      aria-hidden
    >
      {iniciais(nome)}
    </div>
  );
  return anel ? <div className="dp-avatar-anel">{circulo}</div> : circulo;
}
