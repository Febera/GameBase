import type { GameCard } from '@rj/shared';

/** Formato bruto de um jogo vindo da IGDB, só com os campos que pedimos. */
export interface IgdbGame {
  id: number;
  name: string;
  slug: string;
  cover?: { image_id: string };
  first_release_date?: number;
  total_rating?: number;
  total_rating_count?: number;
  hypes?: number;
}

/** Campos pedidos à IGDB para montar um card. */
export const CARD_FIELDS =
  'name,slug,cover.image_id,first_release_date,total_rating,total_rating_count,hypes';

export function igdbImageUrl(imageId: string, size: string): string {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

export function toGameCard(game: IgdbGame): GameCard {
  const imageId = game.cover?.image_id;
  return {
    id: game.id,
    name: game.name,
    slug: game.slug,
    cover: imageId
      ? { url: igdbImageUrl(imageId, 'cover_big'), url2x: igdbImageUrl(imageId, 'cover_big_2x') }
      : null,
    releaseDate: game.first_release_date
      ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10)
      : null,
    rating: typeof game.total_rating === 'number' ? Math.round(game.total_rating) : null,
    free: null,
    price: null,
  };
}
