'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { definirJornada } from '@/actions/horas';
import { formatarBloco, type Jornada, type Periodo } from '@/lib/jornada';

/**
 * As quatro batidas do dia, pelos nomes que a agência usa.
 *
 * São os dois períodos da jornada vistos do jeito de quem bate o ponto:
 * chega, sai para o almoço, volta, vai embora. Chamar as quatro de
 * "entrada" e "saída" duas vezes não dizia nada.
 */
const ROTULOS = ['Entrada', 'Saída p/ almoço', 'Volta do almoço', 'Saída'];

/**
 * Um bloco da jornada: até dois períodos, com o total do dia ao lado.
 *
 * O total aparece enquanto a pessoa digita porque é assim que ela percebe o
 * erro na hora — 8h virou 7h porque trocou 19:00 por 18:00.
 */
function BlocoJornada({
  titulo,
  periodos,
  onChange,
}: {
  titulo: string;
  periodos: Periodo[];
  onChange: (p: Periodo[]) => void;
}) {
  const linhas: Periodo[] = [0, 1].map((i) => periodos[i] ?? { entrada: '', saida: '' });

  function trocar(indice: number, campo: 'entrada' | 'saida', valor: string) {
    const novos = linhas.map((p, i) => (i === indice ? { ...p, [campo]: valor } : p));
    // Períodos em branco não vão para o banco; a limpeza final é no servidor.
    onChange(novos);
  }

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
      <div style={{ flex: '1 1 130px', fontWeight: 600, fontSize: '0.875rem', paddingBottom: 10 }}>
        {titulo}
      </div>

      {linhas.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.7rem' }}>{ROTULOS[i * 2]}</label>
            <input
              type="time"
              className="form-input"
              value={p.entrada}
              onChange={(e) => trocar(i, 'entrada', e.target.value)}
              style={{ width: 110 }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.7rem' }}>{ROTULOS[i * 2 + 1]}</label>
            <input
              type="time"
              className="form-input"
              value={p.saida}
              onChange={(e) => trocar(i, 'saida', e.target.value)}
              style={{ width: 110 }}
            />
          </div>
        </div>
      ))}

      <div style={{ paddingBottom: 10, fontFamily: 'monospace', fontWeight: 700, minWidth: 60, textAlign: 'right' }}>
        {formatarBloco(linhas)}
      </div>
    </div>
  );
}

/**
 * Os horários de um colaborador: segunda a sexta, sábado e uma observação.
 * Usado no Banco de horas e na tela de Horários.
 */
export default function EditorJornada({
  id,
  jornadaInicial,
  notaInicial,
  onSalvo,
}: {
  id: string;
  jornadaInicial: Jornada;
  notaInicial: string | null;
  onSalvo?: () => void;
}) {
  const router = useRouter();
  const [jornada, setJornada] = useState<Jornada>(jornadaInicial);
  const [nota, setNota] = useState(notaInicial ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function salvar() {
    setErro(null);
    setOcupado(true);
    const r = await definirJornada(id, jornada, nota);
    setOcupado(false);
    if (r.erro) return setErro(r.erro);
    onSalvo?.();
    router.refresh();
  }

  return (
    <div>
      <BlocoJornada
        titulo="Segunda a sexta"
        periodos={jornada.semana}
        onChange={(semana) => setJornada((j) => ({ ...j, semana }))}
      />
      <BlocoJornada
        titulo="Sábado"
        periodos={jornada.sabado}
        onChange={(sabado) => setJornada((j) => ({ ...j, sabado }))}
      />
      {erro && <div className="alert alert-danger" style={{ marginBottom: 8 }}>{erro}</div>}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 8 }}>
        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 240px' }}>
          <input
            className="form-input"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Observação: estagiária, contrato 44h…"
          />
        </div>
        <button type="button" className="btn btn-secondary" disabled={ocupado} onClick={salvar}>
          Salvar jornada
        </button>
      </div>
    </div>
  );
}
