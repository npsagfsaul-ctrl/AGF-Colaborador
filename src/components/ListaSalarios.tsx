'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apagarSalario, registrarSalario } from '@/actions/outros';
import { dataBR } from '@/lib/datas';
import { diaDaSemana } from '@/lib/feriados';
import { valorAdiantamento } from '@/lib/pagamentos';
import { formatarDinheiro } from '@/lib/dinheiro';
import Avatar from './Avatar';
import Olho from './Olho';

interface Linha {
  id: string;
  nome: string;
  setor: string | null;
  cargo: string | null;
  historico: { id: string; valorCentavos: number; desde: string; motivo: string | null }[];
}

/** O salário que vale hoje: o mais recente que já começou. */
function atual(l: Linha, hoje: string) {
  return l.historico.find((s) => s.desde <= hoje) ?? null;
}

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

interface Pagamentos {
  /** Dia do adiantamento deste mês. */
  adiantamento: string;
  /** Dia de pagar o mensal (5º dia útil; se cair no sábado, a sexta). */
  mensal: string;
  /** O 5º dia útil quando ele é sábado — para mostrar por que a data é sexta. */
  mensalNoSabado: string | null;
  /** O mês a que o mensal se refere (o anterior). */
  mesDoMensal: number;
}

export default function ListaSalarios({ linhas, hoje, pagamentos }: { linhas: Linha[]; hoje: string; pagamentos: Pagamentos }) {
  const router = useRouter();
  const [ver, setVer] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const oculto = '••••••';
  const mostrar = (c: number | null | undefined) => (ver ? formatarDinheiro(c) : oculto);
  const folha = linhas.reduce((s, l) => s + (atual(l, hoje)?.valorCentavos ?? 0), 0);
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const quando = (data: string) => `${SEMANA[diaDaSemana(data)]} ${dataBR(data).slice(0, 5)}`;

  async function salvar(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const form = e.currentTarget;
    setErro(null);
    setOcupado(true);
    const r = await registrarSalario(id, new FormData(form));
    setOcupado(false);
    if (r.erro) return setErro(r.erro);
    form.reset();
    router.refresh();
  }

  async function apagar(id: string) {
    if (!confirm('Apagar este registro de salário?')) return;
    setOcupado(true);
    const r = await apagarSalario(id);
    setOcupado(false);
    if (r.erro) return setErro(r.erro);
    router.refresh();
  }

  return (
    <div>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="stat-label">Folha do mês</div>
          <div className="dp-num" style={{ fontSize: '1.5rem' }}>{mostrar(folha)}</div>
        </div>
        <div className="text-muted" style={{ fontSize: '0.875rem' }}>{linhas.length} colaboradores</div>
        <div>
          <div className="stat-label">Adiantamento 40% · {quando(pagamentos.adiantamento)}</div>
          <div className="dp-num" style={{ fontSize: '1.1rem' }}>{mostrar(valorAdiantamento(folha))}</div>
        </div>
        <div>
          <div className="stat-label">Salário de {MESES[pagamentos.mesDoMensal - 1]} · 5º dia útil</div>
          <div style={{ fontWeight: 600 }}>
            {quando(pagamentos.mensal)}
            {pagamentos.mensalNoSabado && (
              <span className="text-muted" style={{ fontWeight: 400, fontSize: '0.75rem' }}> (o 5º dia útil é sábado {dataBR(pagamentos.mensalNoSabado).slice(0, 5)})</span>
            )}
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <Olho ver={ver} onClick={() => setVer((v) => !v)} rotulo={ver ? 'Esconder valores' : 'Mostrar valores'} />
        </div>
      </div>

      {erro && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{erro}</div>}

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Colaborador</th>
                <th style={{ textAlign: 'right' }}>Salário</th>
                <th style={{ textAlign: 'right' }}>Adiantamento 40%</th>
                <th className="dp-so-largo" style={{ textAlign: 'left' }}>Desde</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const s = atual(l, hoje);
                const futuro = l.historico.find((x) => x.desde > hoje);
                const aqui = aberto === l.id;
                return (
                  <Fragment key={l.id}>
                    <tr>
                      <td>
                        <div className="dp-pessoa">
                          <Avatar nome={l.nome} />
                          <div>
                            <div style={{ fontWeight: 600 }}>{l.nome}</div>
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>{[l.setor, l.cargo].filter(Boolean).join(' · ')}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="dp-num">{s ? mostrar(s.valorCentavos) : '—'}</span>
                        {futuro && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--dp-acento)' }}>
                            {ver ? formatarDinheiro(futuro.valorCentavos) : 'reajuste'} em {dataBR(futuro.desde)}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}><span className="dp-num">{s ? mostrar(valorAdiantamento(s.valorCentavos)) : '—'}</span></td>
                      <td className="dp-so-largo text-muted">{s ? dataBR(s.desde) : ''}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setAberto(aqui ? null : l.id)}>
                          {aqui ? 'Fechar' : s ? 'Reajustar' : 'Lançar'}
                        </button>
                      </td>
                    </tr>
                    {aqui && (
                      <tr>
                        <td colSpan={5} style={{ background: 'var(--surface-2)' }}>
                          <form onSubmit={(e) => salvar(e, l.id)} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <div className="form-group" style={{ marginBottom: 0, width: 140 }}>
                              <label className="form-label">Novo salário</label>
                              <input name="valor" className="form-input" placeholder="1.850,00" required autoFocus />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">A partir de</label>
                              <input name="desde" type="date" className="form-input" defaultValue={hoje} required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0, flex: '1 1 180px' }}>
                              <label className="form-label">Motivo</label>
                              <input name="motivo" className="form-input" placeholder="Admissão, dissídio, promoção…" />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={ocupado}>Salvar</button>
                          </form>
                          {l.historico.length > 0 && (
                            <ul className="dp-lista" style={{ marginTop: 12 }}>
                              {l.historico.map((h) => (
                                <li key={h.id}>
                                  <span>
                                    <span className="dp-num">{mostrar(h.valorCentavos)}</span>
                                    <span className="text-muted"> · desde {dataBR(h.desde)}{h.motivo ? ` · ${h.motivo}` : ''}</span>
                                  </span>
                                  <button type="button" className="btn btn-outline btn-sm" disabled={ocupado} onClick={() => apagar(h.id)}>Apagar</button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
