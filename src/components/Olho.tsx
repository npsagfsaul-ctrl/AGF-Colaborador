'use client';

/** O olhinho de mostrar/esconder, o mesmo do cadastro de clientes do Portal. */
export default function Olho({ ver, onClick, rotulo }: { ver: boolean; onClick: () => void; rotulo: string }) {
  return (
    <button type="button" className="btn btn-outline btn-sm" onClick={onClick} title={rotulo} aria-label={rotulo}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {ver ? (
          <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.4 5.2A9.7 9.7 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.1 3.9M6.1 6.1C3.8 7.7 2.5 12 2.5 12s3.5 7 9.5 7a9.5 9.5 0 0 0 4.4-1.1" />
        ) : (
          <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6" />
        )}
      </svg>
    </button>
  );
}
