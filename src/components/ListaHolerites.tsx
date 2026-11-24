'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { marcarHolerite, marcarTodosHolerites } from '@/actions/holerites';
import { dataBR } from '@/lib/datas';

interface Linha {
  id: string;
  nome: string;
  setor: string | null;
  entregueEm: string | null;
}

/**
 * A lista do mês: um clique marca a entrega com a data de hoje; outro clique
 * desmarca. É a planilha de "já recebeu?", sem a planilha.
 */
export default function ListaHolerites({
  competencia,
  opcoes,
  linhas,
}: {
  competencia: string;
  opcoes: { valor: string; nome: string }[];
  linhas: Linha[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const faltam = linhas.filter((l) => !l.entregueEm);

  async function alternar(l: Linha) {
    setErro(null);
    setOcupado(l.id);
    const r = await marcarHolerite(l.id, competencia, !l.entregueEm);
    setOcupado(null);
    if (r.erro) return setErro(r.erro);
    router.refresh();
  }

  async function marcarTodos() {
    if (!confirm(`Marcar os ${faltam.length} que faltam como entregues hoje?`)) return;
    setErro(null);
    setOcupado('todos');
    const r = await marcarTodosHolerites(competencia, faltam.map((l) => l.id));
    setOcupado(null);
    if (r.erro) return setErro(r.erro);
    router.refresh();
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Holerites</h1>
        <select
          className="form-select"
          style={{ width: 'auto' }}
          value={competencia}
          onChange={(e) => router.push(`/holerites?mes=${e.target.value}`)}
          aria-label="Mês do holerite"
        >
          {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.nome}</option>)}
        </select>
        <span className="text-muted" style={{ fontSize: '0.9375rem' }}>
          {linhas.length === 0 ? '' : faltam.length === 0 ? 'todos entregues' : `faltam ${faltam.length} de ${linhas.length}`}
        </span>
        {faltam.length > 1 && (
          <button type="button" className="btn btn-outline btn-sm" disabled={ocupado !== null} onClick={marcarTodos}>
            Marcar todos
          </button>
        )}
      </div>

      {erro && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{erro}</div>}

      {linhas.length === 0 ? (
        <div className="card"><p className="text-muted" style={{ margin: 0 }}>Nenhum colaborador ativo.</p></div>
      ) : (
        <div className="card">
          <ul className="dp-lista">
            {linhas.map((l) => (
              <li key={l.id} style={{ alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={!!l.entregueEm}
                    disabled={ocupado !== null}
                    onChange={() => alternar(l)}
                    style={{ width: 18, height: 18 }}
                  />
                  <span style={{ fontWeight: 600 }}>{l.nome}</span>
                  {l.setor && <span className="text-muted" style={{ fontSize: '0.8125rem' }}>{l.setor}</span>}
                </label>
                <span style={{ fontSize: '0.8125rem', color: l.entregueEm ? 'var(--success)' : 'var(--text-muted)' }}>
                  {l.entregueEm ? `entregue ${dataBR(l.entregueEm).slice(0, 5)}` : ocupado === l.id ? '…' : 'pendente'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
