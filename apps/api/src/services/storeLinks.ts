import type { StoreLink } from '@rj/shared';

/** Lojas de PC reconhecidas pelo endereço do site. */
const STORES: { store: string; hosts: string[] }[] = [
  { store: 'Steam', hosts: ['store.steampowered.com', 'steamcommunity.com'] },
  { store: 'Epic Games Store', hosts: ['store.epicgames.com', 'epicgames.com'] },
  { store: 'GOG', hosts: ['gog.com'] },
  { store: 'itch.io', hosts: ['itch.io'] },
  { store: 'Microsoft Store', hosts: ['microsoft.com', 'xbox.com'] },
  { store: 'EA app', hosts: ['ea.com'] },
  { store: 'Ubisoft Store', hosts: ['ubisoft.com', 'ubi.com'] },
  { store: 'Battle.net', hosts: ['battle.net', 'blizzard.com'] },
  { store: 'Humble Store', hosts: ['humblebundle.com'] },
];

function storeFor(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  const match = STORES.find((s) => s.hosts.some((h) => host === h || host.endsWith(`.${h}`)));
  return match?.store ?? null;
}

/** Fica só com links de lojas, um por loja, na ordem da lista acima. */
export function storeLinksFrom(urls: string[]): StoreLink[] {
  const byStore = new Map<string, string>();
  for (const url of urls) {
    const store = storeFor(url);
    // steamcommunity.com é a página da comunidade; prefere a da loja se existir.
    if (store && (!byStore.has(store) || url.includes('store.steampowered.com'))) byStore.set(store, url);
  }
  return STORES.flatMap(({ store }) => (byStore.has(store) ? [{ store, url: byStore.get(store)! }] : []));
}
