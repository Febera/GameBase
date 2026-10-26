import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3333),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  TWITCH_CLIENT_ID: z.string({ required_error: 'obrigatório (Client ID do app na Twitch)' }).trim().min(1, 'obrigatório (Client ID do app na Twitch)'),
  DATABASE_URL: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  DATABASE_DIRECT_URL: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  IP_HASH_SALT: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  ITAD_API_KEY: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  TWITCH_CLIENT_SECRET: z.string({ required_error: 'obrigatório (Client Secret do app na Twitch)' }).trim().min(1, 'obrigatório (Client Secret do app na Twitch)'),
});

export type Config = z.infer<typeof envSchema> & { corsOrigins: string[] };

/** Lê e valida as variáveis de ambiente. Falha cedo, com mensagem clara. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Variáveis de ambiente inválidas:\n${problems}\n` +
        'Copie apps/api/.env.example para apps/api/.env e preencha os valores.',
    );
  }
  const corsOrigins = parsed.data.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return { ...parsed.data, corsOrigins };
}
