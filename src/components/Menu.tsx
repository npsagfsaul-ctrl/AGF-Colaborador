'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITENS = [
  { href: '/', rotulo: 'Painel' },
  { href: '/colaboradores', rotulo: 'Colaboradores' },
  { href: '/horas', rotulo: 'Horas' },
  { href: '/holerites', rotulo: 'Holerites' },
];

export default function Menu() {
  const caminho = usePathname();
  const ativo = (href: string) => (href === '/' ? caminho === '/' : caminho.startsWith(href));

  return (
    <header className="dp-topo">
      <div className="dp-topo-dentro">
        <Link href="/" className="dp-marca">AGF Saul <span>DP</span></Link>
        <nav className="dp-menu">
          {ITENS.map((i) => (
            <Link key={i.href} href={i.href} className={ativo(i.href) ? 'ativo' : undefined}>
              {i.rotulo}
            </Link>
          ))}
        </nav>
        <form action="/api/sair" method="post">
          <button type="submit" className="dp-sair">Sair</button>
        </form>
      </div>
    </header>
  );
}
