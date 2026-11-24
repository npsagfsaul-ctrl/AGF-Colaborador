import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/*
  O `db push` do build precisa de conexão DIRETA com o banco. A integração da
  Neon na Vercel cria as duas: `DATABASE_URL` (com pooler, para o site) e
  `DATABASE_URL_UNPOOLED` (direta). Se só existir a primeira, usa ela mesma.
*/
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
  },
});
