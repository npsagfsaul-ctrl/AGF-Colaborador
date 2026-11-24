'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apagarVida, atualizarVida, excluirDoPlano, incluirNoPlano } from '@/actions/outros';
import { dataBR } from '@/lib/datas';
import { dinheiroParaCampo, formatarDinheiro } from '@/lib/dinheiro';
import type { Resultado } from '@/lib/acao';
import Avatar from './Avatar';

export interface Vida {
  id: string;
  colaboradorId: string;
  colaboradorNome: string;
  setor: string | null;
  parentesco: string;
  nome: string;
  nascimento: string | null;
  plano: string | null;
  carteirinha: string | null;
  valorCentavos: number | null;
  descontoCentavos: number | null;
  inclusao: string | null;
  exclusao: string | null;
  observacao: string | null;
}

const PARENTESCOS = ['Titular', 'Cônjuge', 'Filho(a)', 'Pai/Mãe', 'Outro'];

export default function PlanoSaude({
  vidas,
  colaboradores,
  planos,
  hoje,
}: {
  vidas: Vida[];
  colaboradores: { id: string; nome: string }[];
  planos: string[];
  hoje: string;
}) {
  const router = useRouter();
  const [novo, setNovo] = useState(false);
  const [parentesco, setParentesco] = useState('Titular');
  const [editando, setEditando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const ativas = vidas.filter((v) => !v.exclusao || v.exclusao > hoje);
  const saiu = vidas.filter((v) => v.exclusao && v.exclusao <= hoje);
  const custo = ativas.reduce((s, v) => s + (v.valorCentavos ?? 0), 0);
  const desconto = ativas.reduce((s, v) => s + (v.descontoCentavos ?? 0), 0);

  // Agrupa por colaborador: titular primeiro, dependentes embaixo.
  const familias = new Map<string, Vida[]>();
  for (const v of ativas) familias.set(v.colaboradorId, [...(familias.get(v.colaboradorId) ?? []), v]);
  const grupos = [...familias.values()]
    .map((g) => g.sort((a, b) => (a.parentesco === 'Titular' ? -1 : b.parentesco === 'Titular' ? 1 : 0)))
    .sort((a, b) => a[0].colaboradorNome.localeCompare(b[0].colaboradorNome, 'pt-BR'));

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
      <div className="card" style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center' }}>
        <div><div className="stat-label">Vidas no plano</div><div className="dp-num" style={{ fontSize: '1.5rem' }}>{ativas.length}</div></div>
        <div><div className="stat-label">Custo do mês</div><div className="dp-num" style={{ fontSize: '1.5rem' }}>{formatarDinheiro(custo)}</div></div>
        <div><div className="stat-label">Descontado em folha</div><div className="dp-num" style={{ fontSize: '1.5rem' }}>{formatarDinheiro(desconto)}</div></div>
        <button type="button" className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setNovo((v) => !v)}>
          {novo ? 'Fechar' : '+ Incluir no plano'}
        </button>
      </div>

      <datalist id="planos">{planos.map((p) => <option key={p} value={p} />)}</datalist>

      {novo && (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            rodar(() => incluirNoPlano(new FormData(form)), () => { form.reset(); setParentesco('Titular'); setNovo(false); });
          }}
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Colaborador</label>
              <select name="colaboradorId" className="form-select" required defaultValue="">
                <option value="" disabled>Escolha…</option>
                {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Quem entra</label>
              <select name="parentesco" className="form-select" value={parentesco} onChange={(e) => setParentesco(e.target.value)}>
                {PARENTESCOS.map((p) => <option key={p} value={p}>{p === 'Titular' ? 'O próprio colaborador' : `Dependente: ${p}`}</option>)}
              </select>
            </div>
            {parentesco !== 'Titular' ? (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nome do dependente</label>
                <input name="nome" className="form-input" required />
              </div>
            ) : <div />}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Plano</label>
              <input name="plano" className="form-input" list="planos" placeholder="Unimed Enfermaria…" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Carteirinha</label>
              <input name="carteirinha" className="form-input" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nascimento</label>
              <input name="nascimento" type="date" className="form-input" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Valor do plano</label>
              <input name="valor" className="form-input" placeholder="350,00" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Desconto em folha</label>
              <input name="desconto" className="form-input" placeholder="70,00" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Inclusão</label>
              <input name="inclusao" type="date" className="form-input" defaultValue={hoje} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={ocupado}>Incluir</button>
          </div>
        </form>
      )}

      {erro && <div className="alert alert-danger" style={{ margin: 0 }}>{erro}</div>}

      {grupos.length === 0 ? (
        <div className="card"><p className="text-muted" style={{ margin: 0 }}>Ninguém no plano ainda.</p></div>
      ) : (
        grupos.map((g) => (
          <div key={g[0].colaboradorId} className="card">
            <div className="dp-pessoa" style={{ marginBottom: 8 }}>
              <Avatar nome={g[0].colaboradorNome} tamanho={36} />
              <div>
                <div style={{ fontWeight: 700 }}>{g[0].colaboradorNome}</div>
                {g[0].setor && <div className="text-muted" style={{ fontSize: '0.75rem' }}>{g[0].setor}</div>}
              </div>
            </div>
            <ul className="dp-lista">
              {g.map((v) => (
                <li key={v.id} style={{ flexWrap: 'wrap' }}>
                  {editando === v.id ? (
                    <form
                      style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', width: '100%' }}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        rodar(() => atualizarVida(v.id, fd), () => setEditando(null));
                      }}
                    >
                      <strong style={{ width: '100%' }}>{v.nome} <span className="text-muted" style={{ fontWeight: 400 }}>· {v.parentesco}</span></strong>
                      <input name="plano" className="form-input" list="planos" defaultValue={v.plano ?? ''} placeholder="Plano" style={{ width: 170 }} />
                      <input name="carteirinha" className="form-input" defaultValue={v.carteirinha ?? ''} placeholder="Carteirinha" style={{ width: 170 }} />
                      <input name="valor" className="form-input" defaultValue={dinheiroParaCampo(v.valorCentavos)} placeholder="Valor" style={{ width: 110 }} />
                      <input name="desconto" className="form-input" defaultValue={dinheiroParaCampo(v.descontoCentavos)} placeholder="Desconto" style={{ width: 110 }} />
                      <input name="observacao" className="form-input" defaultValue={v.observacao ?? ''} placeholder="Observação" style={{ flex: '1 1 160px' }} />
                      <button type="submit" className="btn btn-primary btn-sm" disabled={ocupado}>Salvar</button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
                    </form>
                  ) : (
                    <>
                      <span style={{ flex: '1 1 240px' }}>
                        <strong>{v.nome}</strong>{' '}
                        <span className="dp-etiqueta">{v.parentesco}</span>
                        <div className="text-muted" style={{ fontSize: '0.8125rem' }}>
                          {[v.plano, v.carteirinha && `carteirinha ${v.carteirinha}`, v.inclusao && `desde ${dataBR(v.inclusao)}`, v.exclusao && `sai ${dataBR(v.exclusao)}`]
                            .filter(Boolean).join(' · ')}
                        </div>
                      </span>
                      <span style={{ textAlign: 'right' }}>
                        <span className="dp-num">{formatarDinheiro(v.valorCentavos)}</span>
                        {v.descontoCentavos ? <div className="text-muted" style={{ fontSize: '0.75rem' }}>desconta {formatarDinheiro(v.descontoCentavos)}</div> : null}
                      </span>
                      <span style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditando(v.id)}>Editar</button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={ocupado}
                          onClick={() => {
                            const quando = prompt(`Data de exclusão de ${v.nome} do plano (dd/mm/aaaa):`, dataBR(hoje));
                            if (!quando) return;
                            const [d, m, a] = quando.split('/');
                            rodar(() => excluirDoPlano(v.id, `${a}-${m?.padStart(2, '0')}-${d?.padStart(2, '0')}`));
                          }}
                        >
                          Excluir do plano
                        </button>
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {saiu.length > 0 && (
        <details className="card">
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
            Saíram do plano <span className="badge badge-primary" style={{ marginLeft: 8 }}>{saiu.length}</span>
          </summary>
          <ul className="dp-lista" style={{ marginTop: 8 }}>
            {saiu.map((v) => (
              <li key={v.id}>
                <span>
                  <strong>{v.nome}</strong> <span className="text-muted">· {v.parentesco === 'Titular' ? 'titular' : `${v.parentesco} de ${v.colaboradorNome}`}</span>
                  <div className="text-muted" style={{ fontSize: '0.8125rem' }}>
                    {v.inclusao ? `entrou ${dataBR(v.inclusao)} · ` : ''}saiu {dataBR(v.exclusao)}
                  </div>
                </span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={ocupado}
                  onClick={() => { if (confirm(`Apagar de vez o registro de ${v.nome}? Use só se foi cadastrado por engano.`)) rodar(() => apagarVida(v.id)); }}
                >
                  Apagar
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
