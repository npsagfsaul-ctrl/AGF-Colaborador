'use client';

import { useState } from 'react';

export default function EntrarPage() {
  const [senha, setSenha] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEntrando(true);
    try {
      const r = await fetch('/api/entrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      });
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) {
        setErro(j.erro ?? 'Não foi possível entrar.');
        setEntrando(false);
        return;
      }
      window.location.href = '/';
    } catch {
      setErro('Sem conexão. Tente de novo.');
      setEntrando(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'var(--bg)' }}>
      <form onSubmit={entrar} className="card" style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--text-main)' }}>AGF Saul</div>
          <div className="text-muted" style={{ fontSize: '0.875rem' }}>Departamento Pessoal</div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="senha">Senha</label>
          <div style={{ position: 'relative' }}>
            <input
              id="senha"
              type={mostrar ? 'text' : 'password'}
              className="form-input"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoFocus
              required
              style={{ paddingRight: 64 }}
            />
            <button
              type="button"
              onClick={() => setMostrar((v) => !v)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8125rem' }}
            >
              {mostrar ? 'ocultar' : 'mostrar'}
            </button>
          </div>
        </div>

        {erro && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{erro}</div>}

        <button type="submit" className="btn btn-primary" disabled={entrando} style={{ width: '100%' }}>
          {entrando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
