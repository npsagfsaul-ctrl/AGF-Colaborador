'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { salvarQuemRecebe } from '@/actions/beneficios';
import { dinheiroParaCampo, parseDinheiro } from '@/lib/dinheiro';
import { semValor } from '@/lib/beneficio';

interface Linha {
  colaboradorId: string;
  nome: string;
  setor: string | null;
  valorCentavos: number | null;
  porDia: boolean;
  vezesPorDia: number;
}

/**
 * No VT o valor é o da passagem, e a escolha diz quantas por dia.
 * O "por dia (valor do dia)" fica para quem já tinha o valor do dia todo.
 */
const OPCOES = {
  vt: [['2', 'ida e volta'], ['4', '2 conduções cada lado'], ['1', 'só 1 por dia'], ['mes', 'por mês']],
  va: [['1', 'por dia'], ['mes', 'por mês']],
} as const;

/**
 * Quem recebe e quanto, todo mundo numa lista. Valor em branco = não recebe.
 * Fica fechado: é cadastro de uma vez, não do dia a dia.
 */
export default function QuemRecebe({ tipo, linhas }: { tipo: string; linhas: Linha[] }) {
  const router = useRouter();
  const [valores, setValores] = useState(() =>
    Object.fromEntries(linhas.map((l) => [l.colaboradorId, { valor: dinheiroParaCampo(l.valorCentavos), porDia: l.porDia, vezesPorDia: l.vezesPorDia }])),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const recebem = linhas.filter((l) => l.valorCentavos).length;

  async function salvar() {
    setErro(null);
    setOk(false);
    setOcupado(true);
    const r = await salvarQuemRecebe(
      tipo,
      linhas.map((l) => ({ colaboradorId: l.colaboradorId, nome: l.nome, ...valores[l.colaboradorId] })),
    );
    setOcupado(false);
    if (r.erro) return setErro(r.erro);
    setOk(true);
    router.refresh();
  }

  return (
    <details className="card" open={recebem === 0}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
        Quem recebe
        <span className="badge badge-primary" style={{ marginLeft: 8 }}>{recebem}</span>
      </summary>

      <div className="table-wrapper" style={{ marginTop: 12 }}>
        <table>
          <tbody>
            {linhas.map((l) => {
              const v = valores[l.colaboradorId];
              const ruim = !semValor(v.valor) && parseDinheiro(v.valor) === null;
              return (
                <tr key={l.colaboradorId}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{l.nome}</div>
                    {l.setor && <div className="text-muted" style={{ fontSize: '0.75rem' }}>{l.setor}</div>}
                  </td>
                  <td>
                    <input
                      className="form-input"
                      value={v.valor}
                      placeholder="não recebe"
                      onChange={(e) => setValores((s) => ({ ...s, [l.colaboradorId]: { ...v, valor: e.target.value } }))}
                      style={{ width: 120, borderColor: ruim ? 'var(--danger)' : undefined }}
                      aria-label={`Valor de ${l.nome}`}
                    />
                  </td>
                  <td>
                    <select
                      className="form-select"
                      value={v.porDia ? String(v.vezesPorDia) : 'mes'}
                      onChange={(e) => {
                        const x = e.target.value;
                        setValores((s) => ({
                          ...s,
                          [l.colaboradorId]: { ...v, porDia: x !== 'mes', vezesPorDia: x === 'mes' ? 1 : Number(x) },
                        }));
                      }}
                      style={{ width: 'auto' }}
                    >
                      {OPCOES[tipo === 'vt' ? 'vt' : 'va'].map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {erro && <div className="alert alert-danger" style={{ marginTop: 12, marginBottom: 0 }}>{erro}</div>}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
        <button type="button" className="btn btn-primary" disabled={ocupado} onClick={salvar}>Salvar</button>
        {ok && <span style={{ color: 'var(--success)', fontSize: '0.875rem' }}>Salvo.</span>}
      </div>
    </details>
  );
}
