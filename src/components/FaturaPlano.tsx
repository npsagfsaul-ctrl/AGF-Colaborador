'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { marcarPlanoLancado, salvarConsultasPlano } from '@/actions/plano';
import { dataBR } from '@/lib/datas';
import { dinheiroParaCampo, formatarDinheiro } from '@/lib/dinheiro';
import type { LinhaFatura } from '@/lib/planoDados';
import type { Resultado } from '@/lib/acao';
import Avatar from './Avatar';

/**
 * A fatura do mês, como a planilha do DP: titular (empresa paga), dependentes
 * e consultas/exames (colaborador paga), desconto em folha e o total.
 * Consultas e descrição gravam sozinhas ao sair do campo.
 */
export default function FaturaPlano({
  competencia,
  opcoes,
  folhaDe,
  linhas,
}: {
  competencia: string;
  opcoes: { valor: string; nome: string }[];
  /** "dezembro de 2026": a folha em que o desconto entra. */
  folhaDe: string;
  linhas: LinhaFatura[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const empresa = linhas.reduce((s, l) => s + l.empresa, 0);
  const colaboradores = linhas.reduce((s, l) => s + l.colaborador, 0);
  const faltam = linhas.filter((l) => !l.lancadoEm);

  async function rodar(fn: () => Promise<Resultado>) {
    setErro(null);
    setOcupado(true);
    const r = await fn();
    setOcupado(false);
    if (r.erro) return setErro(r.erro);
    router.refresh();
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Fatura de</label>
          <select className="form-select" value={competencia} onChange={(e) => router.push(`/plano?mes=${e.target.value}`)}>
            {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.nome}</option>)}
          </select>
        </div>
        <div><div className="stat-label">Empresa</div><div className="dp-num">{formatarDinheiro(empresa)}</div></div>
        <div><div className="stat-label">Colaboradores (folha de {folhaDe})</div><div className="dp-num">{formatarDinheiro(colaboradores)}</div></div>
        <div><div className="stat-label">Total da fatura</div><div className="dp-num" style={{ fontWeight: 700 }}>{formatarDinheiro(empresa + colaboradores)}</div></div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {linhas.length > 0 && (
            <span className="text-muted" style={{ fontSize: '0.875rem' }}>
              {faltam.length === 0 ? 'todos lançados' : `faltam ${faltam.length} de ${linhas.length}`}
            </span>
          )}
          {faltam.length > 1 && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={ocupado}
              onClick={() => {
                if (confirm(`Marcar os ${faltam.length} que faltam como lançados na folha?`)) {
                  rodar(() => marcarPlanoLancado(competencia, faltam.map((l) => l.colaboradorId), true));
                }
              }}
            >
              Marcar todos
            </button>
          )}
        </div>
      </div>

      {erro && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{erro}</div>}

      {linhas.length === 0 ? (
        <p className="text-muted" style={{ margin: 0 }}>Ninguém no plano neste mês.</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th style={{ textAlign: 'left' }}>Titular</th>
                <th style={{ textAlign: 'right' }} title="Mensalidade do titular: a empresa paga 100%">Titular</th>
                <th style={{ textAlign: 'right' }} title="Mensalidade dos dependentes: o colaborador paga">Dependentes</th>
                <th style={{ textAlign: 'left', width: 120 }} title="Coparticipação: só desconta se usou">Consultas/exames</th>
                <th className="dp-so-largo" style={{ textAlign: 'left' }}>Descrição</th>
                <th style={{ textAlign: 'right' }}>Desc. folha</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <Linha
                  key={`${competencia}-${l.colaboradorId}-${l.consultas}-${l.observacao}`}
                  l={l}
                  ocupado={ocupado}
                  onSalvar={(v, o) => {
                    if (v.trim() === dinheiroParaCampo(l.consultas || null) && o.trim() === l.observacao) return;
                    rodar(() => salvarConsultasPlano(competencia, l.colaboradorId, v, o));
                  }}
                  onMarcar={() => rodar(() => marcarPlanoLancado(competencia, [l.colaboradorId], !l.lancadoEm))}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Linha({
  l,
  ocupado,
  onSalvar,
  onMarcar,
}: {
  l: LinhaFatura;
  ocupado: boolean;
  onSalvar: (valor: string, observacao: string) => void;
  onMarcar: () => void;
}) {
  const [valor, setValor] = useState(dinheiroParaCampo(l.consultas || null));
  const [obs, setObs] = useState(l.observacao);
  const travado = !!l.lancadoEm;

  return (
    <tr style={travado ? { background: 'var(--success-light)' } : undefined}>
      <td>
        <input
          type="checkbox"
          checked={travado}
          disabled={ocupado}
          onChange={onMarcar}
          title={travado ? `Lançado em ${dataBR(l.lancadoEm)}` : 'Marcar como lançado na folha'}
          style={{ width: 18, height: 18 }}
        />
      </td>
      <td>
        <div className="dp-pessoa">
          <Avatar nome={l.nome} tamanho={28} />
          <div>
            <div style={{ fontWeight: 600 }}>{l.nome}</div>
            {l.nomesDependentes.length > 0 && (
              <div className="text-muted" style={{ fontSize: '0.7rem' }}>+ {l.nomesDependentes.join(', ')}</div>
            )}
          </div>
        </div>
      </td>
      <td style={{ textAlign: 'right' }} className="dp-num">{formatarDinheiro(l.titular)}</td>
      <td style={{ textAlign: 'right' }} className="dp-num">{l.dependentes ? formatarDinheiro(l.dependentes) : '—'}</td>
      <td>
        <input
          className="form-input"
          inputMode="decimal"
          value={valor}
          placeholder="não usou"
          disabled={travado}
          onChange={(e) => setValor(e.target.value)}
          onBlur={() => onSalvar(valor, obs)}
          style={{ width: 110 }}
        />
      </td>
      <td className="dp-so-largo">
        <input
          className="form-input"
          value={obs}
          disabled={travado}
          onChange={(e) => setObs(e.target.value)}
          onBlur={() => onSalvar(valor, obs)}
        />
      </td>
      <td style={{ textAlign: 'right' }}>
        <div className="dp-num" style={{ fontWeight: 700 }}>{formatarDinheiro(l.colaborador)}</div>
        {travado && <div className="text-muted" style={{ fontSize: '0.7rem' }}>lançado {dataBR(l.lancadoEm).slice(0, 5)}</div>}
      </td>
    </tr>
  );
}
