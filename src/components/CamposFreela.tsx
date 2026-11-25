import { dinheiroParaCampo } from '@/lib/dinheiro';

export interface DadosFreela {
  nome: string;
  funcao: string | null;
  telefone: string | null;
  pix: string | null;
  diariaCentavos: number | null;
  observacao: string | null;
  nascimento: string | null;
}

export default function CamposFreela({ funcoes, f }: { funcoes: string[]; f?: DadosFreela }) {
  const opcoes = [...new Set(['Coletor', 'Limpeza', ...funcoes])];
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Nome</label>
        <input name="nome" className="form-input" defaultValue={f?.nome} required autoFocus={!f} />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Faz o quê</label>
        <input name="funcao" className="form-input" list="funcoes" defaultValue={f?.funcao ?? ''} placeholder="Coletor, Limpeza…" />
        <datalist id="funcoes">{opcoes.map((o) => <option key={o} value={o} />)}</datalist>
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Diária</label>
        <input name="diaria" className="form-input" defaultValue={dinheiroParaCampo(f?.diariaCentavos)} placeholder="120,00" />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Telefone</label>
        <input name="telefone" className="form-input" defaultValue={f?.telefone ?? ''} />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">PIX</label>
        <input name="pix" className="form-input" defaultValue={f?.pix ?? ''} />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Nascimento</label>
        <input name="nascimento" type="date" className="form-input" defaultValue={f?.nascimento ?? ''} />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Observação</label>
        <input name="observacao" className="form-input" defaultValue={f?.observacao ?? ''} />
      </div>
    </div>
  );
}
