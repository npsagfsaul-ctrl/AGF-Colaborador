'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  adicionarFerias,
  alternarAtivo,
  atualizarColaborador,
  excluirColaborador,
  removerFerias,
} from '@/actions/colaboradores';
import type { Resultado } from '@/lib/acao';
import { dataBR, diasEntre, proximoAniversario, valida, type SituacaoAso, type SituacaoFerias } from '@/lib/datas';
import { formatarHoras } from '@/lib/horas';

export interface Ficha {
  id: string;
  nome: string;
  setor: string | null;
  cargo: string | null;
  ativo: boolean;
  nascimento: string | null;
  admissao: string | null;
  asoUltimo: string | null;
  asoMeses: number;
  observacao: string | null;
  controlaHoras: boolean;
  foraDosProcessos: boolean;
  saldoMinutos: number;
  ferias: { id: string; inicio: string; fim: string; observacao: string | null }[];
}

const CORES_ASO: Record<SituacaoAso, string | undefined> = {
  'sem-registro': undefined,
  vencido: 'var(--danger)',
  'vence-logo': 'var(--warning)',
  'em-dia': 'var(--success)',
};

export default function FichaColaborador({
  c,
  aso,
  situacao,
  setores,
  hoje,
}: {
  c: Ficha;
  aso: { situacao: SituacaoAso; vencimento: string | null; dias: number | null };
  situacao: SituacaoFerias | null;
  setores: string[];
  hoje: string;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function rodar(fn: () => Promise<Resultado>, depois?: () => void) {
    setErro(null);
    setSalvo(false);
    setOcupado(true);
    const r = await fn();
    setOcupado(false);
    if (r.erro) {
      setErro(r.erro);
      return false;
    }
    depois?.();
    router.refresh();
    return true;
  }

  async function salvarDados(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await rodar(() => atualizarColaborador(c.id, fd), () => setSalvo(true));
  }

  async function lancarFerias(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    await rodar(() => adicionarFerias(c.id, fd), () => form.reset());
  }

  const aniversario = valida(c.nascimento) ? proximoAniversario(c.nascimento, hoje) : null;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {erro && <div className="alert alert-danger" style={{ margin: 0 }}>{erro}</div>}

      {/* ─── Dados ─── */}
      <form className="card" onSubmit={salvarDados}>
        <datalist id="setores">{setores.map((s) => <option key={s} value={s} />)}</datalist>
        <div className="grid grid-cols-3 gap-3">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="nome">Nome</label>
            <input id="nome" name="nome" className="form-input" defaultValue={c.nome} required />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="setor">Setor</label>
            <input id="setor" name="setor" className="form-input" list="setores" defaultValue={c.setor ?? ''} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="cargo">Cargo</label>
            <input id="cargo" name="cargo" className="form-input" defaultValue={c.cargo ?? ''} />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="nascimento">Nascimento</label>
            <input id="nascimento" name="nascimento" type="date" className="form-input" defaultValue={c.nascimento ?? ''} />
            {aniversario && (
              <div className="form-hint">
                {aniversario.dias === 0 ? 'Aniversário hoje!' : `Faz ${aniversario.idade} anos em ${dataBR(aniversario.data).slice(0, 5)}`}
              </div>
            )}
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="admissao">Admissão</label>
            <input id="admissao" name="admissao" type="date" className="form-input" defaultValue={c.admissao ?? ''} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
              <label className="form-label" htmlFor="asoUltimo">Último ASO</label>
              <input id="asoUltimo" name="asoUltimo" type="date" className="form-input" defaultValue={c.asoUltimo ?? ''} />
              {aso.vencimento && (
                <div className="form-hint" style={{ color: CORES_ASO[aso.situacao], fontWeight: aso.situacao === 'em-dia' ? undefined : 600 }}>
                  {aso.situacao === 'vencido' ? 'Venceu em ' : 'Vence em '}{dataBR(aso.vencimento)}
                </div>
              )}
            </div>
            <div className="form-group" style={{ marginBottom: 0, width: 100 }}>
              <label className="form-label" htmlFor="asoMeses">Validade</label>
              <select id="asoMeses" name="asoMeses" className="form-select" defaultValue={String(c.asoMeses)}>
                <option value="6">6 meses</option>
                <option value="12">1 ano</option>
                <option value="24">2 anos</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-group" style={{ marginTop: 12, marginBottom: 12 }}>
          <label className="form-label" htmlFor="observacao">Observação</label>
          <textarea id="observacao" name="observacao" className="form-textarea" rows={2} defaultValue={c.observacao ?? ''} />
        </div>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, fontSize: '0.875rem', cursor: 'pointer' }}>
          <input type="checkbox" name="foraDosProcessos" defaultChecked={c.foraDosProcessos} style={{ width: 16, height: 16 }} />
          Não entra nos processos do DP (só aparece em Aniversariantes)
        </label>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button type="submit" className="btn btn-primary" disabled={ocupado}>Salvar</button>
          {salvo && <span style={{ color: 'var(--success)', fontSize: '0.875rem' }}>Salvo.</span>}
        </div>
      </form>

      {/* ─── Férias ─── */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Férias</div>
        <p style={{ margin: '0 0 12px', fontSize: '0.9375rem' }}>
          {!situacao ? (
            <span className="text-muted">Preencha a admissão para calcular.</span>
          ) : situacao.pendente ? (
            <span style={{ color: diasEntre(hoje, situacao.pendente.limite) < 0 ? 'var(--danger)' : undefined }}>
              <strong>{situacao.diasPendentes} dias</strong> para tirar
              {' · '}o mais antigo {diasEntre(hoje, situacao.pendente.limite) < 0 ? 'venceu em' : 'até'}{' '}
              <strong>{dataBR(situacao.pendente.limite)}</strong>
            </span>
          ) : (
            <span>
              Em dia.{situacao.proximoDireito && <> Novo período em {dataBR(situacao.proximoDireito)}.</>}
            </span>
          )}
        </p>

        {c.ferias.length > 0 && (
          <ul className="dp-lista" style={{ marginBottom: 12 }}>
            {c.ferias.map((f) => (
              <li key={f.id} style={{ alignItems: 'center' }}>
                <span>
                  {dataBR(f.inicio)} a {dataBR(f.fim)}
                  <span className="text-muted"> · {diasEntre(f.inicio, f.fim) + 1} dias{f.observacao ? ` · ${f.observacao}` : ''}</span>
                </span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={ocupado}
                  onClick={() => {
                    if (confirm(`Apagar as férias de ${dataBR(f.inicio)}?`)) rodar(() => removerFerias(f.id));
                  }}
                >
                  Apagar
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={lancarFerias} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="inicio">Primeiro dia</label>
            <input id="inicio" name="inicio" type="date" className="form-input" required />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="fim">Último dia</label>
            <input id="fim" name="fim" type="date" className="form-input" required />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 160px' }}>
            <label className="form-label" htmlFor="obsFerias">Observação</label>
            <input id="obsFerias" name="observacao" className="form-input" />
          </div>
          <button type="submit" className="btn btn-secondary" disabled={ocupado}>Adicionar</button>
        </form>
      </div>

      {/* ─── Horas ─── */}
      {c.controlaHoras && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700 }}>Banco de horas</div>
            <div style={{
              fontFamily: 'monospace', fontWeight: 700, fontSize: '1.25rem',
              color: c.saldoMinutos === 0 ? 'var(--text-muted)' : c.saldoMinutos < 0 ? 'var(--danger)' : 'var(--success)',
            }}>
              {formatarHoras(c.saldoMinutos, true)}
            </div>
          </div>
          <Link href={`/horas/${c.id}`} className="btn btn-outline btn-sm">Abrir</Link>
        </div>
      )}

      {/* Decisões raras, no fim e discretas. */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={ocupado}
          onClick={() => {
            if (c.ativo && !confirm(`Marcar ${c.nome} como desligado? A ficha continua guardada.`)) return;
            rodar(() => alternarAtivo(c.id, !c.ativo));
          }}
        >
          {c.ativo ? 'Desligar' : 'Reativar'}
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          style={{ color: 'var(--danger)' }}
          disabled={ocupado}
          onClick={async () => {
            if (!confirm(`Excluir ${c.nome} de vez, com férias, horas e holerites? Não dá para desfazer.`)) return;
            setOcupado(true);
            const r = await excluirColaborador(c.id);
            if (r.erro) {
              setOcupado(false);
              setErro(r.erro);
              return;
            }
            router.replace('/colaboradores');
          }}
        >
          Excluir
        </button>
      </div>
    </div>
  );
}
