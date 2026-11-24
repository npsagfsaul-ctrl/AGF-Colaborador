import { cookies } from 'next/headers';
import { COOKIE, tokenEsperado } from './sessao';

export interface Resultado {
  erro?: string;
  id?: string;
  quantidade?: number;
}

/**
 * Roda uma ação de gravar e DEVOLVE o erro em vez de deixá-lo estourar.
 *
 * Em produção o Next apaga a mensagem de qualquer erro que escape de uma
 * Server Action e manda um parágrafo genérico em inglês no lugar. No Portal
 * isso custou dias: o cadastro de cliente falhava e ninguém conseguia ler por
 * quê. Aqui toda ação passa por este funil, e a tela mostra o texto inteiro.
 *
 * Também confere a sessão de novo, além do middleware: Server Action é
 * endereço público, e a checagem fica perto de quem grava.
 *
 * E nenhuma ação chama `revalidatePath`: quem chama faz `router.refresh()`. O
 * re-render que a revalidação arrasta para dentro da resposta foi a outra
 * metade do problema no Portal.
 */
export async function executar(fn: () => Promise<Resultado | void>): Promise<Resultado> {
  try {
    const esperado = await tokenEsperado();
    const recebido = (await cookies()).get(COOKIE)?.value;
    if (!esperado || recebido !== esperado) {
      return { erro: 'Sua sessão expirou. Entre de novo.' };
    }
    return (await fn()) ?? {};
  } catch (e) {
    return { erro: e instanceof Error && e.message ? e.message : 'Não foi possível salvar.' };
  }
}

/** Texto do formulário, aparado; vazio vira null. */
export function texto(fd: FormData, campo: string): string | null {
  return ((fd.get(campo) as string) || '').trim() || null;
}
