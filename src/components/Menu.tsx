'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Ícones de traço, no estilo dos menus de RH. Um caminho SVG cada. */
const ICONES: Record<string, string> = {
  calendario: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5M8 14h2M14 14h2M8 17h2',
  painel: 'M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z',
  pessoas: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M21 19v-1a4 4 0 0 0-3-3.9M15.5 4.1a3 3 0 0 1 0 5.8',
  bolo: 'M4 20h16M5 20v-7h14v7M12 13V9M12 6.5c.8 0 1.3-.7 1.3-1.4C13.3 4.2 12 3 12 3s-1.3 1.2-1.3 2.1c0 .7.5 1.4 1.3 1.4M5 16c2 1 3 1 4.7 0s2.6-1 4.6 0 2.7 1 4.7 0',
  relogio: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2',
  ampulheta: 'M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9',
  dinheiro: 'M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 10v.01M18 14v.01',
  papel: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  prato: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-1.7 0-3 2.2-3 5s1.3 4 3 4v9',
  onibus: 'M6 17V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v11M6 17h12M6 12h12M8 20v-3M16 20v-3M8.5 14.5v.01M15.5 14.5v.01',
  coracao: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10M9 11h6M12 8v6',
  trofeu: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6',
  maleta: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  sair: 'M10 17l-5-5 5-5M5 12h11M14 4h5v16h-5',
};

function Icone({ nome }: { nome: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONES[nome]} />
    </svg>
  );
}

const GRUPOS: { titulo?: string; itens: { href: string; rotulo: string; icone: string }[] }[] = [
  {
    itens: [
      { href: '/', rotulo: 'Painel', icone: 'painel' },
      { href: '/calendario', rotulo: 'Calendário', icone: 'calendario' },
    ],
  },
  {
    titulo: 'Pessoas',
    itens: [
      { href: '/colaboradores', rotulo: 'Colaboradores', icone: 'pessoas' },
      { href: '/aniversarios', rotulo: 'Aniversariantes', icone: 'bolo' },
      { href: '/horarios', rotulo: 'Horários', icone: 'relogio' },
    ],
  },
  { titulo: 'Jornada', itens: [{ href: '/horas', rotulo: 'Banco de horas', icone: 'ampulheta' }] },
  {
    titulo: 'Remuneração',
    itens: [
      { href: '/salarios', rotulo: 'Salários', icone: 'dinheiro' },
      { href: '/holerites', rotulo: 'Holerites', icone: 'papel' },
    ],
  },
  {
    titulo: 'Benefícios',
    itens: [
      { href: '/va', rotulo: 'Vale Alimentação', icone: 'prato' },
      { href: '/vt', rotulo: 'Vale Transporte', icone: 'onibus' },
      { href: '/plano', rotulo: 'Plano de saúde', icone: 'coracao' },
      { href: '/metas', rotulo: 'Metas', icone: 'trofeu' },
    ],
  },
  { titulo: 'Terceiros', itens: [{ href: '/freelas', rotulo: 'Freelance', icone: 'maleta' }] },
];

/**
 * Menu lateral agrupado por assunto, no jeito do Sólides. No celular ele
 * fica escondido atrás do botão de três tracinhos.
 */
export default function Menu() {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const ativo = (href: string) => (href === '/' ? caminho === '/' : caminho.startsWith(href));

  // Escolheu uma tela no celular: fecha o menu.
  useEffect(() => setAberto(false), [caminho]);

  return (
    <>
      <header className="dp-barra-celular">
        <button type="button" className="dp-hamburguer" aria-label="Abrir menu" onClick={() => setAberto(true)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <span className="dp-marca">AGF Saul <span>DP</span></span>
      </header>

      {aberto && <div className="dp-fundo" onClick={() => setAberto(false)} />}

      <aside className={`dp-lateral${aberto ? ' aberta' : ''}`}>
        <Link href="/" className="dp-marca dp-marca-lateral">AGF Saul <span>DP</span></Link>
        <nav>
          {GRUPOS.map((g, i) => (
            <div key={i} className="dp-grupo">
              {g.titulo && <div className="dp-grupo-titulo">{g.titulo}</div>}
              {g.itens.map((item) => (
                <Link key={item.href} href={item.href} className={`dp-item${ativo(item.href) ? ' ativo' : ''}`}>
                  <Icone nome={item.icone} />
                  {item.rotulo}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <form action="/api/sair" method="post" className="dp-grupo">
          <button type="submit" className="dp-item dp-item-sair">
            <Icone nome="sair" />
            Sair
          </button>
        </form>
      </aside>
    </>
  );
}
