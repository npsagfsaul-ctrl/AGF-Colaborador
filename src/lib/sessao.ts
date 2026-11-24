/**
 * Uma senha só, a do DP, guardada na Vercel como `SENHA_DP`.
 *
 * O cookie não guarda a senha: guarda um resumo dela (SHA-256). Trocar a
 * senha na Vercel derruba todas as sessões abertas de uma vez — que é o que se
 * quer quando a senha vazou.
 *
 * Usa a Web Crypto, que existe tanto no middleware (edge) quanto no servidor.
 */
export const COOKIE = 'dp_sessao';

export async function tokenDaSenha(senha: string): Promise<string> {
  const dados = new TextEncoder().encode(`agf-dp:${senha}`);
  const resumo = await crypto.subtle.digest('SHA-256', dados);
  return Array.from(new Uint8Array(resumo)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** O token esperado agora, ou null se a senha ainda não foi configurada. */
export async function tokenEsperado(): Promise<string | null> {
  const senha = process.env.SENHA_DP;
  return senha ? tokenDaSenha(senha) : null;
}
