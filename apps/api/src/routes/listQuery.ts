import { z } from 'zod';

const integer = (min: number, max: number, fallback: number) =>
  z.coerce
    .number({ invalid_type_error: 'deve ser um número' })
    .int('deve ser inteiro')
    .min(min, `mínimo ${min}`)
    .max(max, `máximo ${max}`)
    .default(fallback);

/** Parâmetros comuns a todas as listas paginadas. */
export const listQuery = z.object({
  offset: integer(0, 1000, 0),
  limit: integer(1, 50, 20),
  /** Por padrão, jogos com foco em conteúdo sexual ficam ocultos. */
  adult: z.enum(['hide', 'show'], { message: 'use "hide" ou "show"' }).default('hide'),
});

/** Ordenação das listas da home (avaliações por padrão; clicar de novo inverte). */
export const sortQuery = z.object({
  sort: z.enum(['reviews', 'discount', 'value', 'release'], { message: 'ordenação inválida' }).default('reviews'),
  order: z.enum(['desc', 'asc'], { message: 'use "desc" ou "asc"' }).default('desc'),
});
