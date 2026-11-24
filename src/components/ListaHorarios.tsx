'use client';

import { Fragment, useState } from 'react';
import { minutosDaSemana, type Jornada, type Periodo } from '@/lib/jornada';
import { formatarHoras } from '@/lib/horas';
import Avatar from './Avatar';
import EditorJornada from './EditorJornada';

interface Linha {
  id: string;
  nome: string;
  setor: string | null;
  nota: string | null;
  jornada: Jornada;
}

/** "09:00–12:00 · 14:00–19:00", ou um traço se não trabalha. */
function horario(ps: Periodo[]) {
  return ps.length ? ps.map((p) => `${p.entrada}–${p.saida}`).join(' · ') : '—';
}

/** A entrada e saída de todo mundo numa lista só; "Editar" abre na própria linha. */
export default function ListaHorarios({ linhas }: { linhas: Linha[] }) {
  const [aberto, setAberto] = useState<string | null>(null);

  if (linhas.length === 0) {
    return <div className="card"><p className="text-muted" style={{ margin: 0 }}>Nenhum colaborador ativo.</p></div>;
  }

  return (
    <div className="card">
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Colaborador</th>
              <th style={{ textAlign: 'left' }}>Segunda a sexta</th>
              <th style={{ textAlign: 'left' }}>Sábado</th>
              <th className="dp-so-largo" style={{ textAlign: 'right' }}>Semana</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const aqui = aberto === l.id;
              const semana = minutosDaSemana(l.jornada);
              return (
                <Fragment key={l.id}>
                  <tr>
                    <td>
                      <div className="dp-pessoa">
                        <Avatar nome={l.nome} tamanho={28} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{l.nome}</div>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>{[l.setor, l.nota].filter(Boolean).join(' · ')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="dp-num" style={{ fontWeight: 500 }}>{horario(l.jornada.semana)}</td>
                    <td className="dp-num" style={{ fontWeight: 500 }}>{horario(l.jornada.sabado)}</td>
                    <td className="dp-so-largo dp-num" style={{ textAlign: 'right' }}>{semana ? `${formatarHoras(semana)}h` : '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setAberto(aqui ? null : l.id)}>
                        {aqui ? 'Fechar' : 'Editar'}
                      </button>
                    </td>
                  </tr>
                  {aqui && (
                    <tr>
                      <td colSpan={5} style={{ background: 'var(--surface-2)' }}>
                        <EditorJornada id={l.id} jornadaInicial={l.jornada} notaInicial={l.nota} onSalvo={() => setAberto(null)} />
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
  );
}
