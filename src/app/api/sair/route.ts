import { NextResponse } from 'next/server';
import { COOKIE } from '@/lib/sessao';

export async function POST(req: Request) {
  const resposta = NextResponse.redirect(new URL('/entrar', req.url), 303);
  resposta.cookies.set(COOKIE, '', { path: '/', maxAge: 0 });
  return resposta;
}
