'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apagarPremio, marcarPremioAtivado, registrarPremio } from '@/actions/outros';
import { dataBR } from '@/lib/datas';
import type { Resultado } from '@/lib/acao';
import Avatar from './Avatar';

/** Quem bateu a meta no mês e ganhou a assinatura, e se ela já foi ativada. */
export default function Metas({
  competencia,
  opcoes,
  colaboradores,
  servicos,
  premios,
}: {
  competencia: string;
  opcoes: { valor: string; nome: string }[];
  colaboradores: { id: string; nome: string }[];
  servicos: string[];
  premios: { id: string; nome: string; setor: string | null; servico: string; observacao: string | null; ativadoEm: string | null }[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function rodar(fn: () => Promise<Resultado>, depois?: () => void) {
    setErro(null);
    setOcupado(true);
    const r = await fn();
    setOcupado(false);
    if (r.erro) return setErro(r.erro);
    depois?.();
    router.refresh();
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          rodar(() => registrarPremio(new FormData(form)), () => form.reset());
        }}
        style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}
      >
        <input type="hidden" name="competencia" value={competencia} />
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Mês</label>
          <select className="form-select" value={competencia} onChange={(e) => router.push(`/metas?mes=${e.target.value}`)}>
            {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.nome}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px' }}>
          <label className="form-label">Quem ganhou</label>
          <select name="colaboradorId" className="form-select" required defaultValue="">
            <option value="" disabled>Escolha…</option>
            {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0, width: 160 }}>
          <label className="form-label">Assinatura</label>
          <input name="servico" className="form-input" list="servicos" defaultValue="Spotify" required />
          <datalist id="servicos">{servicos.map((s) => <option key={s} value={s} />)}</datalist>
        </div>
        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 160px' }}>
          <label className="form-label">Observação</label>
          <input name="observacao" className="form-input" placeholder="Meta batida, e-mail da conta…" />
        </div>
        <button type="submit" className="btn btn-primary" disabled={ocupado}>Registrar</button>
      </form>

      {erro && <div className="alert alert-danger" style={{ margin: 0 }}>{erro}</div>}

      <div className="card">
        {premios.length === 0 ? (
          <p className="text-muted" style={{ margin: 0 }}>Ninguém registrado neste mês.</p>
        ) : (
          <ul className="dp-lista">
            {premios.map((p) => (
              <li key={p.id}>
                <label className="dp-pessoa" style={{ cursor: 'pointer', flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={!!p.ativadoEm}
                    disabled={ocupado}
                    onChange={() => rodar(() => marcarPremioAtivado(p.id, !p.ativadoEm))}
                    title="Assinatura ativada"
                    style={{ width: 18, height: 18 }}
                  />
                  <Avatar nome={p.nome} tamanho={30} />
                  <span>
                    <strong>{p.nome}</strong> <span className="dp-etiqueta">{p.servico}</span>
                    {p.observacao && <div className="text-muted" style={{ fontSize: '0.8125rem' }}>{p.observacao}</div>}
                  </span>
                </label>
                <span style={{ fontSize: '0.8125rem', color: p.ativadoEm ? 'var(--success)' : 'var(--text-muted)' }}>
                  {p.ativadoEm ? `ativada ${dataBR(p.ativadoEm).slice(0, 5)}` : 'falta ativar'}
                </span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={ocupado}
                  onClick={() => { if (confirm(`Apagar o prêmio de ${p.nome}?`)) rodar(() => apagarPremio(p.id)); }}
                >
                  Apagar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
