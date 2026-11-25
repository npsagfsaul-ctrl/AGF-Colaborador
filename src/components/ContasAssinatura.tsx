'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apagarConta, pagouConta, salvarConta } from '@/actions/assinaturas';
import { dataBR, diasEntre } from '@/lib/datas';
import { dinheiroParaCampo, formatarDinheiro } from '@/lib/dinheiro';
import type { Resultado } from '@/lib/acao';
import Olho from './Olho';

export interface Conta {
  id: string;
  servico: string;
  email: string | null;
  senha: string | null;
  proximoPagamento: string | null;
  valorCentavos: number | null;
  telefone: string | null;
  linkConvite: string | null;
  endereco: string | null;
  observacao: string | null;
  membros: { id: string; nome: string }[];
}

/**
 * A mensagem que vai para o colaborador. Conta com link de convite (Spotify
 * Família): o convite e o endereço. Senão (HBO): o login, no texto do DP.
 */
function mensagem(c: Conta): string {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' }).format(new Date()));
  const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  if (c.linkConvite) {
    return [
      `${saudacao}, tudo bem?`,
      `Segue o convite para o grupo do *${c.servico.toUpperCase()}*! 🎧`,
      'Entre com a sua conta pelo link abaixo:',
      c.linkConvite,
      ...(c.endereco ? ['', 'Quando pedir o endereço, use:', c.endereco] : []),
      '',
      '*LEMBRANDO QUE É DE USO EXCLUSIVO DO COLABORADOR*',
    ].join('\n');
  }
  return [
    `${saudacao}, tudo bem?`,
    `Venho reforçar os dados do seu acesso na *${c.servico.toUpperCase()}*! 🎬`,
    'Lembrando que existe um acesso para cada colaborador que atingiu as metas, e cada colaborador deverá usar apenas uma tela!',
    `E-mail: ${c.email ?? ''}`,
    `Senha: ${c.senha ?? ''}`,
    '',
    '*LEMBRANDO QUE É DE USO EXCLUSIVO DO COLABORADOR*',
  ].join('\n');
}

/**
 * As contas das assinaturas de prêmio (como o Word do DP): quem usa, e-mail,
 * senha escondida, próximo pagamento e a mensagem pronta para copiar.
 */
export default function ContasAssinatura({
  contas,
  colaboradores,
  servicos,
  hoje,
}: {
  contas: Conta[];
  colaboradores: { id: string; nome: string }[];
  servicos: string[];
  hoje: string;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<string | null>(null); // id, 'nova' ou null
  const [verSenha, setVerSenha] = useState<Set<string>>(new Set());
  const [copiado, setCopiado] = useState<string | null>(null);
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

  async function copiar(chave: string, textoCopiar: string) {
    let ok = false;
    try {
      await navigator.clipboard.writeText(textoCopiar);
      ok = true;
    } catch {
      // Navegador sem permissão de área de transferência: o jeito antigo.
      const t = document.createElement('textarea');
      t.value = textoCopiar;
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      ok = document.execCommand('copy');
      t.remove();
    }
    if (!ok) return setErro('Não consegui copiar. Tente de novo.');
    setErro(null);
    setCopiado(chave);
    setTimeout(() => setCopiado((c) => (c === chave ? null : c)), 2000);
  }

  const props = (id?: string) => ({
    colaboradores,
    servicos,
    ocupado,
    onSalvar: (fd: FormData) => rodar(() => salvarConta(id ?? null, fd), () => setEditando(null)),
    onCancelar: () => setEditando(null),
  });

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Contas das assinaturas</h2>
        {contas.some((c) => c.valorCentavos) && (
          <span className="text-muted" style={{ fontSize: '0.875rem' }}>
            {formatarDinheiro(contas.reduce((s, c) => s + (c.valorCentavos ?? 0), 0))} por mês
          </span>
        )}
        {editando !== 'nova' && (
          <button type="button" className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setEditando('nova')}>
            + Nova conta
          </button>
        )}
      </div>

      {erro && <div className="alert alert-danger" style={{ margin: 0 }}>{erro}</div>}
      {editando === 'nova' && <Formulario {...props()} />}

      {contas.length === 0 && editando !== 'nova' && (
        <div className="card"><p className="text-muted" style={{ margin: 0 }}>Nenhuma conta cadastrada.</p></div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {contas.map((c) => {
          if (editando === c.id) return <div key={c.id} style={{ gridColumn: '1 / -1' }}><Formulario c={c} {...props(c.id)} /></div>;
          const dias = c.proximoPagamento ? diasEntre(hoje, c.proximoPagamento) : null;
          const corPag = dias === null ? undefined : dias < 0 ? 'var(--danger)' : dias <= 7 ? 'var(--warning)' : undefined;
          const ver = verSenha.has(c.id);
          return (
            <div key={c.id} className="card" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8, alignContent: 'start', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="dp-etiqueta">{c.servico}</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: corPag ?? 'var(--text-muted)', fontWeight: corPag ? 700 : undefined }}>
                  {c.proximoPagamento
                    ? `paga ${dataBR(c.proximoPagamento)}${c.valorCentavos ? ` · ${formatarDinheiro(c.valorCentavos)}` : ''}${dias !== null && dias < 0 ? ' · venceu' : dias === 0 ? ' · hoje' : ''}`
                    : 'sem data de pagamento'}
                </span>
              </div>
              <div style={{ fontWeight: 700 }}>
                {c.membros.length ? c.membros.map((m) => m.nome.split(' ')[0]).join(', ') : <span className="text-muted">ninguém usando</span>}
              </div>
              <div style={{ fontSize: '0.875rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 4 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="text-muted" style={{ width: 64 }}>E-mail</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email ?? '—'}</span>
                  {c.email && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => copiar(`${c.id}-e`, c.email!)}>
                      {copiado === `${c.id}-e` ? 'Copiado' : 'Copiar'}
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="text-muted" style={{ width: 64 }}>Senha</span>
                  <span className="dp-num" style={{ flex: 1 }}>{c.senha ? (ver ? c.senha : '••••••••') : '—'}</span>
                  {c.senha && (
                    <>
                      <Olho
                        ver={ver}
                        rotulo={ver ? 'Esconder senha' : 'Mostrar senha'}
                        onClick={() => setVerSenha((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}
                      />
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => copiar(`${c.id}-s`, c.senha!)}>
                        {copiado === `${c.id}-s` ? 'Copiado' : 'Copiar'}
                      </button>
                    </>
                  )}
                </div>
                {[
                  { k: 't', rotulo: 'Telefone', v: c.telefone },
                  { k: 'l', rotulo: 'Convite', v: c.linkConvite },
                  { k: 'n', rotulo: 'Endereço', v: c.endereco },
                ].filter((x) => x.v).map((x) => (
                  <div key={x.k} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className="text-muted" style={{ width: 64 }}>{x.rotulo}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={x.v!}>{x.v}</span>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => copiar(`${c.id}-${x.k}`, x.v!)}>
                      {copiado === `${c.id}-${x.k}` ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                ))}
              </div>
              {c.observacao && <div className="text-muted" style={{ fontSize: '0.8125rem' }}>{c.observacao}</div>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => copiar(`${c.id}-m`, mensagem(c))}>
                  {copiado === `${c.id}-m` ? 'Mensagem copiada' : c.linkConvite ? 'Copiar convite' : 'Copiar mensagem'}
                </button>
                {c.proximoPagamento && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={ocupado}
                    onClick={() => { if (confirm(`Marcar ${c.servico} de ${dataBR(c.proximoPagamento)} como pago? O próximo pagamento passa para o mês seguinte.`)) rodar(() => pagouConta(c.id)); }}
                  >
                    Pago
                  </button>
                )}
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditando(c.id)}>Editar</button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={ocupado}
                  onClick={() => { if (confirm(`Apagar a conta ${c.servico} (${c.email ?? 'sem e-mail'})?`)) rodar(() => apagarConta(c.id)); }}
                >
                  Apagar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Formulario({
  c,
  colaboradores,
  servicos,
  ocupado,
  onSalvar,
  onCancelar,
}: {
  c?: Conta;
  colaboradores: { id: string; nome: string }[];
  servicos: string[];
  ocupado: boolean;
  onSalvar: (fd: FormData) => void;
  onCancelar: () => void;
}) {
  const marcados = new Set(c?.membros.map((m) => m.id));
  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        onSalvar(new FormData(e.currentTarget));
      }}
    >
      <div className="grid grid-cols-3 gap-3">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Assinatura</label>
          <input name="servico" className="form-input" list="servicos-conta" defaultValue={c?.servico ?? 'HBO Max'} required />
          <datalist id="servicos-conta">{servicos.map((s) => <option key={s} value={s} />)}</datalist>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">E-mail</label>
          <input name="email" type="email" className="form-input" defaultValue={c?.email ?? ''} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Senha</label>
          <input name="senha" className="form-input" defaultValue={c?.senha ?? ''} autoComplete="off" />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Próximo pagamento</label>
          <input name="proximoPagamento" type="date" className="form-input" defaultValue={c?.proximoPagamento ?? ''} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Valor</label>
          <input name="valor" className="form-input" inputMode="decimal" defaultValue={dinheiroParaCampo(c?.valorCentavos)} placeholder="40,90" />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Telefone</label>
          <input name="telefone" className="form-input" defaultValue={c?.telefone ?? ''} />
        </div>
        <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
          <label className="form-label">Link de convite (Spotify Família)</label>
          <input name="linkConvite" className="form-input" defaultValue={c?.linkConvite ?? ''} placeholder="https://www.spotify.com/br-pt/family/join/invite/…" />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Endereço do convite</label>
          <input name="endereco" className="form-input" defaultValue={c?.endereco ?? ''} />
        </div>
        <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 3' }}>
          <label className="form-label">Observação</label>
          <input name="observacao" className="form-input" defaultValue={c?.observacao ?? ''} />
        </div>
      </div>
      <div className="form-label" style={{ marginTop: 12 }}>Quem usa</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 4 }}>
        {colaboradores.map((p) => (
          <label key={p.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input type="checkbox" name="membros" value={p.id} defaultChecked={marcados.has(p.id)} />
            {p.nome}
          </label>
        ))}
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={ocupado}>Salvar</button>
        <button type="button" className="btn btn-outline" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}
