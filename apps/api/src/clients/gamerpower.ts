import { z } from 'zod';
import { UpstreamError } from '../lib/errors.js';

/** Giveaway como vem da API do GamerPower (só os campos usados). */
const giveawaySchema = z.object({
  id: z.number(),
  title: z.string(),
  worth: z.string().optional().default('N/A'),
  thumbnail: z.string().optional().default(''),
  image: z.string().optional().default(''),
  open_giveaway_url: z.string().optional().default(''),
  gamerpower_url: z.string().optional().default(''),
  type: z.string().optional().default(''),
  platforms: z.string().optional().default(''),
  end_date: z.string().optional().default('N/A'),
  status: z.string().optional().default('Active'),
  users: z.number().optional().default(0),
});

export type RawGiveaway = z.infer<typeof giveawaySchema>;

export interface GamerPowerClient {
  /** Giveaways ativos de jogos completos para PC, dos mais populares para os menos. */
  pcGameGiveaways(): Promise<RawGiveaway[]>;
}

const URL_GIVEAWAYS =
  'https://www.gamerpower.com/api/giveaways?platform=pc&type=game&sort-by=popularity';

export function createGamerPowerClient(fetchFn: typeof fetch = fetch): GamerPowerClient {
  return {
    async pcGameGiveaways() {
      let res: Response;
      try {
        res = await fetchFn(URL_GIVEAWAYS, { headers: { Accept: 'application/json' } });
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : String(cause);
        throw new UpstreamError('gamerpower', 0, `Sem conexão com o GamerPower: ${reason}`);
      }

      // O GamerPower responde 201 com um objeto de aviso quando não há giveaways.
      if (res.status === 201) return [];
      if (!res.ok) {
        throw new UpstreamError('gamerpower', res.status, `O GamerPower respondeu HTTP ${res.status}.`);
      }

      const body: unknown = await res.json();
      if (!Array.isArray(body)) return [];
      // Itens fora do formato esperado são ignorados, em vez de derrubar a lista toda.
      return body.flatMap((raw) => {
        const parsed = giveawaySchema.safeParse(raw);
        return parsed.success ? [parsed.data] : [];
      });
    },
  };
}
