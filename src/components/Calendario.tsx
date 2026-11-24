'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  atrasos as calcularAtrasos, diasNoMes, INTERVALOS_MESES, iso, NOMES_MES, ocorrenciasNoMes,
  posicaoNoMes, rotuloFrequencia, textoMensalSemana, textoSemanal,
} from '@/lib/agenda';
import { diaDaSemana, ehDiaUtil, feriadoEm, feriadosDoAno } from '@/lib/feriados';
import { dataBR } from '@/lib/datas';
import type { ItemAgendaView } from '@/lib/agendaDados';
import type { Resultado } from '@/lib/acao';
import {
  alternarFeito, alternarItemAgenda, criarItemAgenda, excluirItemAgenda, marcarVariasFeitas, type NovoItemAgenda,
} from '@/actions/agenda';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * A agenda do DP: o mês em grade, com sábado, domingo e feriado nacional
 * apagados (o setor não atua), e cada compromisso marcável como feito.
 *
 * Veio da agenda dos setores do Portal. A diferença é a regra do dia: aqui o
 * sábado também fecha, e o feriado também.
 */
export default function Calendario({ itens, mes, ano, hoje }: { itens: ItemAgendaView[]; mes: number; ano: number; hoje: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [dataDoForm, setDataDoForm] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const feitos = new Set(itens.flatMap((i) => i.feitos.map((d) => `${i.id}|${d}`)));
  const porDia = new Map<string, ItemAgendaView[]>();
  for (const item of itens) {
    for (const data of ocorrenciasNoMes(item, mes, ano)) porDia.set(data, [...(porDia.get(data) ?? []), item]);
  }
  const atrasos = calcularAtrasos(itens, feitos, hoje);
  const tituloDe = new Map(itens.map((i) => [i.id, i.titulo]));
  const feriadosDoMes = feriadosDoAno(ano).filter((f) => Number(f.data.slice(5, 7)) === mes);

  const total = diasNoMes(mes, ano);
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const prev = mes === 1 ? { m: 12, a: ano - 1 } : { m: mes - 1, a: ano };
  const next = mes === 12 ? { m: 1, a: ano + 1 } : { m: mes + 1, a: ano };

  async function rodar(chave: string, fn: () => Promise<Resultado>) {
    setOcupado(chave);
    setErro(null);
    const r = await fn();
    setOcupado(null);
    if (r.erro) return setErro(r.erro);
    router.refresh();
  }

  function abrirNovoEm(data: string) {
    setDataDoForm(data);
    setFormAberto(true);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  return (
    <div>
      {atrasos.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <strong>{atrasos.length === 1 ? '1 item atrasado' : `${atrasos.length} itens atrasados`}</strong>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {atrasos.map((a) => (
              <div key={a.itemId} style={{ fontSize: '0.875rem' }}>
                • {tituloDe.get(a.itemId)} — desde {dataBR(a.desde)}{' '}
                <span style={{ opacity: 0.75 }}>
                  ({a.diasDeAtraso === 1 ? '1 dia' : `${a.diasDeAtraso} dias`}{a.quantidade > 1 ? `, ${a.quantidade} vezes` : ''})
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ marginLeft: 8, padding: '1px 8px', fontSize: '0.72rem' }}
                  disabled={ocupado === a.itemId}
                  onClick={() => rodar(a.itemId, () => marcarVariasFeitas(a.itemId, a.datas))}
                >
                  {a.quantidade > 1 ? `dar baixa nas ${a.quantidade}` : 'marcar como feito'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {erro && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{erro}</div>}

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ fontSize: '1.0625rem', fontWeight: 700 }}>{NOMES_MES[mes - 1]} de {ano}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 4 }}>
            <Link href={`/calendario?mes=${prev.m}&ano=${prev.a}`} className="btn btn-secondary btn-sm" style={{ padding: '2px 10px' }}>‹</Link>
            <Link href="/calendario" className="btn btn-secondary btn-sm" style={{ padding: '2px 10px' }}>Hoje</Link>
            <Link href={`/calendario?mes=${next.m}&ano=${next.a}`} className="btn btn-secondary btn-sm" style={{ padding: '2px 10px' }}>›</Link>
          </div>
        </div>

        {/* Cabeçalho e dias na mesma grade, colunas minmax(0,1fr): assim a
            coluna vazia do fim de semana não encolhe e desalinha os rótulos
            (o defeito que a agenda do Portal teve). */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
          {DIAS_SEMANA.map((d) => (
            <div key={d} style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600 }}>{d}</div>
          ))}
          {Array.from({ length: primeiro }, (_, i) => <div key={`v${i}`} />)}

          {Array.from({ length: total }, (_, i) => i + 1).map((dia) => {
            const data = iso(ano, mes, dia);
            const doDia = porDia.get(data) ?? [];
            const ehHoje = data === hoje;
            const passou = data < hoje;
            const feriado = feriadoEm(data);
            const fimDeSemana = [0, 6].includes(diaDaSemana(data));
            const fechado = !ehDiaUtil(data);

            return (
              <div
                key={dia}
                onClick={fechado ? undefined : () => abrirNovoEm(data)}
                title={
                  fechado
                    ? feriado && !feriado.facultativo ? `${feriado.nome} — feriado nacional` : 'Fim de semana — o DP não atua'
                    : `Cadastrar para o dia ${dia}`
                }
                style={{
                  minHeight: 88,
                  minWidth: 0,
                  border: `1px solid ${ehHoje ? 'var(--dp-acento)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: 4,
                  background: fechado ? 'var(--surface-2)' : ehHoje ? 'var(--dp-acento-claro)' : 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  cursor: fechado ? 'default' : 'pointer',
                  opacity: fimDeSemana ? 0.45 : 1,
                }}
              >
                <div style={{
                  fontSize: '0.75rem',
                  fontWeight: ehHoje ? 700 : 500,
                  color: ehHoje ? 'var(--dp-acento)' : 'var(--text-muted)',
                  display: 'flex',
                  justifyContent: fechado ? 'flex-end' : 'space-between',
                  alignItems: 'center',
                }}>
                  {!fechado && <span style={{ opacity: 0.5, fontSize: '0.8125rem', lineHeight: 1 }}>+</span>}
                  <span>{dia}</span>
                </div>

                {feriado && (
                  <div style={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    lineHeight: 1.2,
                    color: feriado.facultativo ? 'var(--warning)' : 'var(--danger)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {feriado.nome}{feriado.facultativo ? ' (facultativo)' : ''}
                  </div>
                )}

                {doDia.map((item) => {
                  const chave = `${item.id}|${data}`;
                  const feito = feitos.has(chave);
                  const atrasado = !feito && passou;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={ocupado === chave}
                      onClick={(e) => {
                        e.stopPropagation();
                        rodar(chave, () => alternarFeito(item.id, data, !feito));
                      }}
                      title={`${item.titulo} — ${feito ? 'feito' : atrasado ? 'atrasado' : 'a fazer'} (clique para marcar)`}
                      style={{
                        textAlign: 'left',
                        fontSize: '0.6875rem',
                        lineHeight: 1.25,
                        padding: '3px 5px',
                        borderRadius: 4,
                        border: 'none',
                        cursor: 'pointer',
                        background: feito ? 'var(--success-light)' : atrasado ? 'var(--danger-light)' : 'var(--dp-acento-claro)',
                        color: feito ? 'var(--success)' : atrasado ? '#c0392b' : 'var(--dp-acento)',
                        fontWeight: 600,
                        textDecoration: feito ? 'line-through' : 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: '100%',
                        opacity: ocupado === chave ? 0.5 : 1,
                      }}
                    >
                      {feito ? '✓ ' : atrasado ? '! ' : '○ '}{item.titulo}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span><Quadradinho cor="var(--success)" />feito</span>
          <span><Quadradinho cor="var(--danger)" />atrasado</span>
          <span><Quadradinho cor="var(--dp-acento)" />a fazer</span>
          <span><Quadradinho cor="var(--border)" />sem expediente</span>
        </div>

        {feriadosDoMes.length > 0 && (
          <div style={{ marginTop: 8, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {feriadosDoMes.map((f) => `${dataBR(f.data).slice(0, 5)} ${f.nome}${f.facultativo ? ' (facultativo)' : ''}`).join(' · ')}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }} ref={formRef}>
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>Compromissos do DP</span>
          <button className="btn btn-primary btn-sm" onClick={() => { setDataDoForm(null); setFormAberto((v) => !v); }}>
            {formAberto ? 'Fechar' : '+ Novo'}
          </button>
        </div>

        {formAberto && (
          <FormNovo
            key={dataDoForm ?? 'hoje'}
            dataInicial={dataDoForm ?? hoje}
            onPronto={() => { setFormAberto(false); setDataDoForm(null); router.refresh(); }}
          />
        )}

        {itens.length === 0 ? (
          <p className="text-muted" style={{ fontSize: '0.875rem', margin: 0 }}>
            Nada cadastrado. Clique num dia do calendário ou em <strong>+ Novo</strong>.
          </p>
        ) : (
          <div>
            {itens.map((item, i) => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 0',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)', opacity: item.ativo ? 1 : 0.55,
              }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                    {item.titulo}
                    {!item.ativo && <span className="badge badge-warning" style={{ marginLeft: 6, fontSize: '0.65rem' }}>pausado</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {rotuloFrequencia(item)}{item.observacao ? ` · ${item.observacao}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" disabled={ocupado === item.id} onClick={() => rodar(item.id, () => alternarItemAgenda(item.id, !item.ativo))}>
                    {item.ativo ? 'Pausar' : 'Reativar'}
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={ocupado === item.id}
                    onClick={() => {
                      if (confirm(`Excluir "${item.titulo}"?\n\nO histórico do que já foi marcado também sai.`)) rodar(item.id, () => excluirItemAgenda(item.id));
                    }}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Quadradinho({ cor }: { cor: string }) {
  return <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: cor, marginRight: 5 }} />;
}

type Repeticao = 'UNICA' | 'DIAS_UTEIS' | 'SEMANAL' | 'MENSAL' | 'MENSAL_SEMANA_ORDEM' | 'MENSAL_SEMANA_ULTIMA' | 'ANUAL';

/**
 * Cadastro partindo de um dia, como no Google Agenda: as repetições já vêm
 * escritas com aquele dia ("toda segunda-feira", "mensal no dia 20").
 */
function FormNovo({ dataInicial, onPronto }: { dataInicial: string; onPronto: () => void }) {
  const [titulo, setTitulo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [data, setData] = useState(dataInicial);
  const [repeticao, setRepeticao] = useState<Repeticao>('UNICA');
  const [intervalo, setIntervalo] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(data);
  const pos = dataValida ? posicaoNoMes(data) : null;
  const util = dataValida && ehDiaUtil(data);
  const feriado = dataValida ? feriadoEm(data) : null;

  const nomeDia = pos ? textoSemanal(pos.diaSemana).replace(/^Toda /, '') : '';
  const naSemana = (ordem: number) => (pos ? `Mensal ${textoMensalSemana(pos.diaSemana, ordem).replace(' de cada mês', '').replace(/^N/, 'n')}` : '');

  const opcoes: { valor: Repeticao; texto: string }[] = pos && util ? [
    { valor: 'UNICA', texto: 'Não se repete' },
    { valor: 'DIAS_UTEIS', texto: 'Todo dia útil (segunda a sexta)' },
    { valor: 'SEMANAL', texto: `Semanal: cada ${nomeDia}` },
    { valor: 'MENSAL', texto: `Mensal no dia ${pos.dia}` },
    ...(pos.ordem <= 4 ? [{ valor: 'MENSAL_SEMANA_ORDEM' as Repeticao, texto: naSemana(pos.ordem) }] : []),
    ...(pos.ehUltima ? [{ valor: 'MENSAL_SEMANA_ULTIMA' as Repeticao, texto: naSemana(-1) }] : []),
    { valor: 'ANUAL', texto: `Anual em ${pos.dia} de ${NOMES_MES[pos.mes - 1].toLowerCase()}` },
  ] : [];
  const rep = opcoes.some((o) => o.valor === repeticao) ? repeticao : 'UNICA';
  const ehMensal = rep === 'MENSAL' || rep === 'MENSAL_SEMANA_ORDEM' || rep === 'MENSAL_SEMANA_ULTIMA';

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!pos || !util) return;
    const base = { titulo, observacao };
    const mensal = { intervaloMeses: ehMensal ? intervalo : 1, mesBase: pos.mes };
    const dados: NovoItemAgenda =
      rep === 'UNICA' ? { ...base, frequencia: 'UNICA', dataUnica: data }
      : rep === 'DIAS_UTEIS' ? { ...base, frequencia: 'DIAS_UTEIS' }
      : rep === 'SEMANAL' ? { ...base, frequencia: 'SEMANAL', diaSemana: pos.diaSemana }
      : rep === 'ANUAL' ? { ...base, frequencia: 'MENSAL', diaMes: pos.dia, intervaloMeses: 12, mesBase: pos.mes }
      : rep === 'MENSAL' ? { ...base, frequencia: 'MENSAL', diaMes: pos.dia, ...mensal }
      : { ...base, frequencia: 'MENSAL_SEMANA', diaSemana: pos.diaSemana, semanaDoMes: rep === 'MENSAL_SEMANA_ULTIMA' ? -1 : pos.ordem, ...mensal };

    setSalvando(true);
    setErro(null);
    const r = await criarItemAgenda(dados);
    setSalvando(false);
    if (r.erro) return setErro(r.erro);
    onPronto();
  }

  return (
    <form onSubmit={salvar} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 16 }}>
      <div className="form-group">
        <label className="form-label">O que precisa ser feito?</label>
        <input className="form-input" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Enviar folha para a contabilidade" maxLength={80} required autoFocus />
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label">Dia</label>
          <input type="date" className="form-input" style={{ width: 180 }} value={data} onChange={(e) => setData(e.target.value)} required />
        </div>
        {opcoes.length > 0 && (
          <div className="form-group" style={{ marginBottom: 12, flex: 1, minWidth: 260 }}>
            <label className="form-label">Repetir</label>
            <select className="form-select" value={rep} onChange={(e) => setRepeticao(e.target.value as Repeticao)}>
              {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
            </select>
          </div>
        )}
        {ehMensal && (
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">A cada</label>
            <select className="form-select" value={intervalo} onChange={(e) => setIntervalo(Number(e.target.value))}>
              {INTERVALOS_MESES.filter((n) => n !== 12).map((n) => <option key={n} value={n}>{n === 1 ? '1 mês' : `${n} meses`}</option>)}
            </select>
          </div>
        )}
      </div>

      {dataValida && !util && (
        <p style={{ color: 'var(--danger)', fontSize: '0.8125rem', marginTop: -4, marginBottom: 12 }}>
          {feriado && !feriado.facultativo ? `${feriado.nome} é feriado` : 'Fim de semana'} — o DP não atua. Escolha outro dia.
        </p>
      )}
      {rep !== 'UNICA' && rep !== 'DIAS_UTEIS' && (
        <p className="form-hint" style={{ marginTop: -4 }}>Se cair em fim de semana ou feriado, aparece no dia útil anterior.</p>
      )}

      <div className="form-group">
        <label className="form-label">Observação</label>
        <input className="form-input" value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={160} />
      </div>

      {erro && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{erro}</div>}
      <button type="submit" className="btn btn-primary btn-sm" disabled={salvando || !util}>
        {salvando ? 'Salvando…' : 'Adicionar'}
      </button>
    </form>
  );
}
