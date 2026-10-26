import type { z } from 'zod';
import { BadRequestError } from './errors.js';

/** Valida a entrada com Zod e lança BadRequestError com mensagem legível. */
export function parseOrThrow<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'entrada'}: ${issue.message}`)
      .join('; ');
    throw new BadRequestError(message);
  }
  return result.data;
}
