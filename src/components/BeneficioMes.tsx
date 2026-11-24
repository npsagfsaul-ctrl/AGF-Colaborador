'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { definirDiasUteis, marcarRecarga, salvarDiasRecarga } from '@/actions/beneficios';
import { dataBR } from '@/lib/datas';
import { formatarDinheiro } from '@/lib/dinheiro';
import { rotuloValor } from '@/lib/beneficio';
import type { Resultado } from '@/lib/acao';
import Avatar from './Avatar';

interface Linha {
  id: string;
  nome: string;
  setor: string | null;
  valorCentavos: number;
  porDia: boolean;
  vezesPorDia: number;
  /** Os dias dela no mês sem desconto: seg a sex, mais sábados se trabalha sábado. */
  padrao: number;
  sabado: boolean;
  dias: number | null;
  motivo: string;
  carregadoEm: string | null;
  aCarregar: number;
  ferias: { inicio: string; fim: string }[];
}

/**
 * A recarga do mês: os dias de cada um (já com os dias úteis do mês), o
 * motivo do desconto, o valor calculado e a marca de "carregado".
 *
 * Dias e motivo gravam sozinhos ao sair do campo: é uma lista de ir
 * descendo e corrigindo, sem botão de salvar por linha.
 */
export default function BeneficioMes({
  tipo,
  competencia,
  opcoes,
  diasUteis,
  linhas,
}: {
  tipo: string;
  competencia: string;
  opcoes: { valor: string; nome: string }[];
  diasUteis: number;
  linhas: Linha[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const faltam = linhas.filter((l) => !l.carregadoEm);
  const total = linhas.reduce((s, l) => s + l.aCarregar, 0);

  async function rodar(fn: () => Promise<Resultado>) {
    setErro(null);
    setOcupado(true);
    const r = await fn();
    setOcupado(false);
    if (r.erro) return setErro(r.erro);
    router.refresh();
  }

  function salvarLinha(l: Linha, diasTexto: string, motivo: string) {
    const t = diasTexto.trim();
    const dias = t === '' ? null : Number(t);
    if (dias !== null && !Number.isInteger(dias)) return setErro(`Dias de ${l.nome}: use um número inteiro.`);
    const mesmoDias = (dias ?? l.padrao) === (l.dias ?? l.padrao);
    if (mesmoDias && motivo.trim() === l.motivo) return;
    rodar(() => salvarDiasRecarga(tipo, competencia, l.id, dias === l.padrao ? null : dias, motivo));
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Mês</label>
          <select
            className="form-select"
            value={competencia}
            onChange={(e) => router.push(`/${tipo}?mes=${e.target.value}`)}
          >
            {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.nome}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0, width: 110 }}>
          <label className="form-label">Dias úteis</label>
          <input
            key={`${competencia}-${diasUteis}`}
            type="number"
            min={0}
            max={31}
            className="form-input"
            defaultValue={diasUteis}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (n !== diasUteis) rodar(() => definirDiasUteis(tipo, competencia, n));
            }}
          />
        </div>
        <div style={{ paddingBottom: 8 }}>
          <span className="text-muted" style={{ fontSize: '0.8125rem' }}>Total </span>
          <span className="dp-num">{formatarDinheiro(total)}</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 4 }}>
          {linhas.length > 0 && (
            <span className="text-muted" style={{ fontSize: '0.875rem' }}>
              {faltam.length === 0 ? 'todos carregados' : `faltam ${faltam.length} de ${linhas.length}`}
            </span>
          )}
          {faltam.length > 1 && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={ocupado}
              onClick={() => {
                if (confirm(`Marcar os ${faltam.length} que faltam como carregados hoje?`)) {
                  rodar(() => marcarRecarga(tipo, competencia, faltam.map((l) => l.id), true));
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
        <p className="text-muted" style={{ margin: 0 }}>Ninguém recebe ainda. Preencha os valores em “Quem recebe”, logo abaixo.</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th style={{ textAlign: 'left' }}>Colaborador</th>
                <th style={{ textAlign: 'left', width: 80 }}>Dias</th>
                <th className="dp-so-largo" style={{ textAlign: 'left' }}>Motivo</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <LinhaRecarga
                  key={`${competencia}-${l.id}-${l.dias}-${l.motivo}-${l.padrao}`}
                  l={l}
                  ocupado={ocupado}
                  onSalvar={(d, m) => salvarLinha(l, d, m)}
                  onMarcar={() => rodar(() => marcarRecarga(tipo, competencia, [l.id], !l.carregadoEm))}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LinhaRecarga({
  l,
  ocupado,
  onSalvar,
  onMarcar,
}: {
  l: Linha;
  ocupado: boolean;
  onSalvar: (dias: string, motivo: string) => void;
  onMarcar: () => void;
}) {
  const [dias, setDias] = useState(String(l.dias ?? l.padrao));
  const [motivo, setMotivo] = useState(l.motivo);
  const desconto = Number(dias) < l.padrao;
  const travado = !!l.carregadoEm;

  return (
    <tr style={travado ? { background: 'var(--success-light)' } : undefined}>
      <td>
        <input
          type="checkbox"
          checked={travado}
          disabled={ocupado}
          onChange={onMarcar}
          title={travado ? `Carregado em ${dataBR(l.carregadoEm)}` : 'Marcar como carregado'}
          style={{ width: 18, height: 18 }}
        />
      </td>
      <td>
        <div className="dp-pessoa">
          <Avatar nome={l.nome} tamanho={28} />
          <div>
            <div style={{ fontWeight: 600 }}>{l.nome}</div>
            {l.sabado && <div className="text-muted" style={{ fontSize: '0.7rem' }}>trabalha sábado</div>}
            {l.ferias.length > 0 && (
              <div style={{ fontSize: '0.7rem', color: 'var(--warning)', fontWeight: 600 }}>
                férias {l.ferias.map((f) => `${dataBR(f.inicio).slice(0, 5)}–${dataBR(f.fim).slice(0, 5)}`).join(', ')}
              </div>
            )}
          </div>
        </div>
      </td>
      <td>
        <input
          type="number"
          min={0}
          max={31}
          className="form-input"
          value={dias}
          disabled={travado}
          onChange={(e) => setDias(e.target.value)}
          onBlur={() => onSalvar(dias, motivo)}
          style={{ width: 70, color: desconto ? 'var(--danger)' : undefined, fontWeight: desconto ? 700 : undefined }}
        />
      </td>
      <td className="dp-so-largo">
        <input
          className="form-input"
          value={motivo}
          disabled={travado}
          placeholder={desconto ? 'Por que descontou?' : ''}
          onChange={(e) => setMotivo(e.target.value)}
          onBlur={() => onSalvar(dias, motivo)}
        />
      </td>
      <td style={{ textAlign: 'right' }}>
        <div className="dp-num">{formatarDinheiro(l.aCarregar)}</div>
        <div className="text-muted" style={{ fontSize: '0.7rem' }}>
          {travado ? `carregado ${dataBR(l.carregadoEm).slice(0, 5)}` : rotuloValor(l, formatarDinheiro(l.valorCentavos))}
        </div>
      </td>
    </tr>
  );
}
