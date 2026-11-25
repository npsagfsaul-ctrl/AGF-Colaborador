/**
 * De A a Z como se lê em português: acento e maiúscula não mudam a ordem
 * ("Ágata" fica junto de "Ana", não depois do "Z"). Feito aqui e não no banco
 * porque a ordem do banco depende da configuração dele.
 */
export const porNome = (a: { nome: string }, b: { nome: string }) =>
  a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
