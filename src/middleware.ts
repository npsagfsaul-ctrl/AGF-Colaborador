import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, tokenEsperado } from '@/lib/sessao';

/**
 * Tudo aqui é dado pessoal de colaborador — saldo de horas, aniversário, ASO.
 * Então tudo fica atrás da senha, e não só as telas: as ações de gravar também
 * passam por aqui, porque são requisições para as mesmas rotas.
 */
export async function middleware(req: NextRequest) {
  const esperado = await tokenEsperado();
  const recebido = req.cookies.get(COOKIE)?.value;

  if (esperado && recebido === esperado) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/entrar';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  // Fora da senha só a própria tela de entrar e os arquivos do Next.
  matcher: ['/((?!entrar|api/entrar|_next/static|_next/image|favicon.ico).*)'],
};
