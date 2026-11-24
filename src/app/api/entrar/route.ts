import { NextResponse } from 'next/server';
import { COOKIE, tokenDaSenha } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/**
 * Confere a senha e abre a sessão.
 *
 * Rota de API, e não Server Action, de propósito: em produção o Next apaga a
 * mensagem de erro de uma Server Action, e "senha errada" precisa chegar
 * escrito na tela.
 */
export async function POST(req: Request) {
  const senhaCerta = process.env.SENHA_DP;
  if (!senhaCerta) {
    return NextResponse.json(
      { erro: 'A senha do site ainda não foi configurada. Na Vercel, crie a variável SENHA_DP.' },
      { status: 503 },
    );
  }

  const { senha } = (await req.json().catch(() => ({}))) as { senha?: string };

  if (!senha || senha !== senhaCerta) {
    // Um respiro antes de responder: tentar senha atrás de senha fica lento.
    await new Promise((r) => setTimeout(r, 700));
    return NextResponse.json({ erro: 'Senha incorreta.' }, { status: 401 });
  }

  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.set(COOKIE, await tokenDaSenha(senhaCerta), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  });
  return resposta;
}
