'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  alternarFreelaAtivo,
  apagarDiaria,
  atualizarFreela,
  excluirFreela,
  lancarDiaria,
  marcarDiarias,
} from '@/actions/outros';
import { dataBR } from '@/lib/datas';
import { dinheiroParaCampo, formatarDinheiro } from '@/lib/dinheiro';
import type { Resultado } from '@/lib/acao';
import Avatar from './Avatar';
import CamposFreela, { type DadosFreela } from './CamposFreela';

interface Ficha extends DadosFreela {
  id: string;
  ativo: boolean;
  diarias: { id: string; data: string; valorCentavos: number; observacao: string | null; pagoEm: string | null }[];
}

export default function FichaFreela({ f, funcoes, hoje }: { f: Ficha; funcoes: string[]; hoje: string }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const pendentes = f.diarias.filter((d) => !d.pagoEm);
  const pagas = f.diarias.filter((d) => d.pagoEm);
  const aPagar = pendentes.reduce((s, d) => s + d.valorCentavos, 0);

  async function rodar(fn: () => Promise<Resultado>, depois?: () => void) {
    setErro(null);
    setOcupado(true);
    const r = await fn();
    setOcupado(false);
    if (r.erro) return setErro(r.erro);
    depois?.();
    router.refresh();
  }

  const linhaDiaria = (d: Ficha['diarias'][number]) => (
    <li key={d.id}>
      <label className="dp-pessoa" style={{ cursor: 'pointer', flex: 1 }}>
        <input
          type="checkbox"
          checked={!!d.pagoEm}
          disabled={ocupado}
          onChange={() => rodar(() => marcarDiarias([d.id], !d.pagoEm))}
          title={d.pagoEm ? `Pago em ${dataBR(d.pagoEm)}` : 'Marcar como pago'}
          style={{ width: 18, height: 18 }}
        />
        <span>
          {dataBR(d.data)}
          {d.observacao && <span className="text-muted"> · {d.observacao}</span>}
          {d.pagoEm && <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>pago {dataBR(d.pagoEm)}</div>}
        </span>
      </label>
      <span className="dp-num">{formatarDinheiro(d.valorCentavos)}</span>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={ocupado}
        onClick={() => { if (confirm(`Apagar a diária de ${dataBR(d.data)}?`)) rodar(() => apagarDiaria(d.id)); }}
      >
        Apagar
      </button>
    </li>
  );

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="card">
        <div className="dp-cabecalho">
          <Avatar nome={f.nome} tamanho={72} anel />
          <div style={{ flex: 1 }}>
            <h1 className="page-title" style={{ margin: 0 }}>{f.nome}</h1>
            <div className="dp-etiquetas">
              {f.funcao && <span className="dp-etiqueta">{f.funcao}</span>}
              {!f.ativo && <span className="dp-etiqueta perigo">inativo</span>}
            </div>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditando((v) => !v)}>
            {editando ? 'Fechar' : 'Editar dados'}
          </button>
        </div>
        <div className="dp-dados">
          {f.telefone && <span>Telefone <strong>{f.telefone}</strong></span>}
          {f.pix && <span>PIX <strong>{f.pix}</strong></span>}
          {f.diariaCentavos ? <span>Diária <strong>{formatarDinheiro(f.diariaCentavos)}</strong></span> : null}
          <span>A pagar <strong style={{ color: aPagar ? 'var(--danger)' : undefined }}>{formatarDinheiro(aPagar)}</strong></span>
        </div>
        {editando && (
          <form
            style={{ marginTop: 16 }}
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              rodar(() => atualizarFreela(f.id, fd), () => setEditando(false));
            }}
          >
            <CamposFreela funcoes={funcoes} f={f} />
            <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }} disabled={ocupado}>Salvar</button>
          </form>
        )}
      </div>

      {erro && <div className="alert alert-danger" style={{ margin: 0 }}>{erro}</div>}

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Diárias</div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            rodar(() => lancarDiaria(f.id, new FormData(form)), () => {
              (form.elements.namedItem('observacao') as HTMLInputElement).value = '';
            });
          }}
          style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}
        >
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Dia</label>
            <input name="data" type="date" className="form-input" defaultValue={hoje} required />
          </div>
          <div className="form-group" style={{ marginBottom: 0, width: 120 }}>
            <label className="form-label">Valor</label>
            <input name="valor" className="form-input" defaultValue={dinheiroParaCampo(f.diariaCentavos)} required />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 160px' }}>
            <label className="form-label">Observação</label>
            <input name="observacao" className="form-input" placeholder="Meio período, cobriu férias…" />
          </div>
          <button type="submit" className="btn btn-secondary" disabled={ocupado}>Lançar</button>
        </form>

        {pendentes.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' }}>
              <strong style={{ color: 'var(--danger)' }}>A pagar · {formatarDinheiro(aPagar)}</strong>
              {pendentes.length > 1 && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={ocupado}
                  onClick={() => {
                    if (confirm(`Marcar as ${pendentes.length} diárias (${formatarDinheiro(aPagar)}) como pagas hoje?`)) {
                      rodar(() => marcarDiarias(pendentes.map((d) => d.id), true));
                    }
                  }}
                >
                  Pagar todas
                </button>
              )}
            </div>
            <ul className="dp-lista">{pendentes.map(linhaDiaria)}</ul>
          </>
        )}

        {pagas.length > 0 && (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>Pagas ({pagas.length})</summary>
            <ul className="dp-lista" style={{ marginTop: 8 }}>{pagas.map(linhaDiaria)}</ul>
          </details>
        )}

        {f.diarias.length === 0 && <p className="text-muted" style={{ margin: 0 }}>Nenhuma diária lançada.</p>}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-outline btn-sm" disabled={ocupado} onClick={() => rodar(() => alternarFreelaAtivo(f.id, !f.ativo))}>
          {f.ativo ? 'Marcar como inativo' : 'Reativar'}
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          style={{ color: 'var(--danger)' }}
          disabled={ocupado}
          onClick={async () => {
            if (!confirm(`Excluir ${f.nome} de vez, com todas as diárias? Não dá para desfazer.`)) return;
            setOcupado(true);
            const r = await excluirFreela(f.id);
            if (r.erro) { setOcupado(false); return setErro(r.erro); }
            router.replace('/freelas');
          }}
        >
          Excluir
        </button>
      </div>
    </div>
  );
}
