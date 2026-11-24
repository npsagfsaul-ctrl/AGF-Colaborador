'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { criarColaborador, criarVarios } from '@/actions/colaboradores';

/**
 * Cadastrar um (e ir direto para a ficha dele) ou vários de uma vez, colando
 * a lista de nomes — que é o caso do primeiro dia.
 */
export default function NovoColaborador({ setores }: { setores: string[] }) {
  const router = useRouter();
  const [modo, setModo] = useState<'fechado' | 'um' | 'varios'>('fechado');
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function salvarUm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    const r = await criarColaborador(new FormData(e.currentTarget));
    setOcupado(false);
    if (r.erro) return setErro(r.erro);
    router.push(`/colaboradores/${r.id}`);
  }

  async function salvarVarios(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    const fd = new FormData(e.currentTarget);
    const r = await criarVarios(String(fd.get('lista') ?? ''), String(fd.get('setor') ?? ''));
    setOcupado(false);
    if (r.erro) return setErro(r.erro);
    setModo('fechado');
    setOk(`${r.quantidade} cadastrado(s).`);
    router.refresh();
  }

  if (modo === 'fechado') {
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setModo('um')}>+ Novo colaborador</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setModo('varios')}>Cadastrar vários</button>
        {ok && <span style={{ color: 'var(--success)', fontSize: '0.875rem' }}>{ok}</span>}
      </div>
    );
  }

  const listaSetores = (
    <datalist id="setores">
      {setores.map((s) => <option key={s} value={s} />)}
    </datalist>
  );

  return (
    <div className="card">
      {listaSetores}
      {modo === 'um' ? (
        <form onSubmit={salvarUm} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: '2 1 220px' }}>
            <label className="form-label" htmlFor="nome">Nome</label>
            <input id="nome" name="nome" className="form-input" required autoFocus />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 160px' }}>
            <label className="form-label" htmlFor="setor">Setor</label>
            <input id="setor" name="setor" className="form-input" list="setores" />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 160px' }}>
            <label className="form-label" htmlFor="cargo">Cargo</label>
            <input id="cargo" name="cargo" className="form-input" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Cadastrar'}</button>
          <button type="button" className="btn btn-outline" onClick={() => { setModo('fechado'); setErro(null); }}>Cancelar</button>
        </form>
      ) : (
        <form onSubmit={salvarVarios}>
          <div className="form-group">
            <label className="form-label" htmlFor="lista">Um nome por linha</label>
            <textarea
              id="lista"
              name="lista"
              className="form-textarea"
              rows={8}
              required
              autoFocus
              placeholder={'Maria Silva\nJoão Souza - Financeiro'}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: '0 1 220px' }}>
              <label className="form-label" htmlFor="setorVarios">Setor de todos</label>
              <input id="setorVarios" name="setor" className="form-input" list="setores" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Cadastrar'}</button>
            <button type="button" className="btn btn-outline" onClick={() => { setModo('fechado'); setErro(null); }}>Fechar</button>
          </div>
        </form>
      )}
      {erro && <div className="alert alert-danger" style={{ marginTop: 12, marginBottom: 0 }}>{erro}</div>}
    </div>
  );
}
