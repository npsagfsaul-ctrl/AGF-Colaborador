'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { criarFreela } from '@/actions/outros';
import CamposFreela from './CamposFreela';

export default function NovoFreela({ funcoes }: { funcoes: string[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (!aberto) {
    return <button type="button" className="btn btn-primary btn-sm" onClick={() => setAberto(true)}>+ Novo freelancer</button>;
  }

  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        setErro(null);
        setOcupado(true);
        const r = await criarFreela(new FormData(e.currentTarget));
        setOcupado(false);
        if (r.erro) return setErro(r.erro);
        router.push(`/freelas/${r.id}`);
      }}
    >
      <CamposFreela funcoes={funcoes} />
      {erro && <div className="alert alert-danger" style={{ marginTop: 12, marginBottom: 0 }}>{erro}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="submit" className="btn btn-primary" disabled={ocupado}>Cadastrar</button>
        <button type="button" className="btn btn-outline" onClick={() => setAberto(false)}>Cancelar</button>
      </div>
    </form>
  );
}
