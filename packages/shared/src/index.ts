/**
 * Contratos compartilhados entre backend e frontend.
 * Qualquer mudança aqui quebra a compilação dos dois lados, o que é intencional.
 */

export interface CoverImage {
  /** Capa no tamanho padrão (264x374). */
  url: string;
  /** Capa em alta densidade, para telas retina (528x748). */
  url2x: string;
}

/** O mínimo necessário para desenhar um card de jogo da IGDB. */
export interface GameCard {
  id: number;
  name: string;
  slug: string;
  cover: CoverImage | null;
  /** Data de lançamento no formato AAAA-MM-DD. */
  releaseDate: string | null;
  /** Nota combinada da IGDB (0–100), arredondada. */
  rating: number | null;
  /** true quando é gratuito na Steam; null quando não se sabe. */
  free: boolean | null;
  /** Preço atual na Steam, em reais, quando é pago. */
  price: StorePrice | null;
  /** Total de avaliações (Steam; senão, IGDB). Usado para ordenar. */
  reviewCount?: number | null;
  /** Avaliações na Steam: % positivas e total, quando já verificadas. */
  steamReviews?: { percent: number; total: number } | null;
}

export interface Money {
  amount: number;
  /** Código ISO 4217, como "BRL". */
  currency: string;
}

export interface StorePrice {
  current: Money;
  regular: Money;
  /** Percentual de desconto (0 quando não está em promoção). */
  cut: number;
}

/** Divisões de "Novos populares". */
export type NewGamesCategory = 'free' | 'demo' | 'paid';

/** Jogo grátis por tempo limitado: 100% de desconto (IsThereAnyDeal) ou giveaway (GamerPower). */
export interface GiveawayCard {
  /** "itad-<id>" ou "gp-<id>", conforme a fonte. */
  id: string;
  title: string;
  /** Capa vertical da IGDB, quando o jogo foi encontrado lá. */
  cover: CoverImage | null;
  /** Imagem do próprio GamerPower, usada quando não há capa. */
  image: string | null;
  igdbId: number | null;
  /** ID da IsThereAnyDeal, quando conhecido (abre a página da oferta). */
  itadId: string | null;
  releaseDate: string | null;
  reviewCount: number | null;
  /** Preço normal, quando a fonte informa em valor (IsThereAnyDeal). */
  regular: Money | null;
  /** Valor normal em texto, como o GamerPower informa ("$19.99"). */
  worth: string | null;
  /** Fim do giveaway (AAAA-MM-DD), quando informado. */
  endDate: string | null;
  /** Loja onde se resgata, como "Epic Games Store". */
  store: string;
  /** Link para resgatar. */
  url: string;
}

/** Oferta com grande desconto (IsThereAnyDeal). */
export interface DealCard {
  /** ID do jogo na IsThereAnyDeal. */
  id: string;
  title: string;
  cover: CoverImage | null;
  /** Capa da própria IsThereAnyDeal, usada quando não há capa da IGDB. */
  boxart: string | null;
  igdbId: number | null;
  shop: string;
  price: Money;
  regular: Money;
  /** Percentual de desconto (0–100). */
  cut: number;
  /** Nota da IGDB (0–100), quando o jogo foi encontrado lá. */
  rating: number | null;
  releaseDate: string | null;
  reviewCount: number | null;
  /** Fim da promoção (ISO 8601), quando informado. */
  expiry: string | null;
  /** Link da loja, exatamente como a IsThereAnyDeal fornece. */
  url: string;
}

/** Página de resultados para rolagem infinita. */
export interface Page<T> {
  items: T[];
  /** Offset da próxima página, ou null quando acabou. */
  nextOffset: number | null;
  total: number;
  /** Jogos que o servidor ainda está verificando e podem entrar na lista em breve. */
  pending?: number;
}

/** Ordenação das listas da home: avaliações (padrão), desconto, valor original ou lançamento. */
export type ListSort = 'reviews' | 'discount' | 'value' | 'release';
export type SortOrder = 'desc' | 'asc';

/** Resgate de um jogo grátis por tempo limitado, mostrado na página do jogo. */
export interface GiveawayInfo {
  store: string;
  url: string;
  endDate: string | null;
  regular: Money | null;
  worth: string | null;
}

/** Valor do parâmetro `adult` aceito por todas as listas. */
export type AdultMode = 'hide' | 'show';

/** Formato de erro devolvido pela API. */
export interface ApiErrorBody {
  error: string;
  message: string;
}

/** Quantos jogam juntos, pelos modos multijogador da IGDB (só PC quando há essa informação). */
export interface PlayerCounts {
  onlineMax: number | null;
  onlineCoopMax: number | null;
  offlineMax: number | null;
  offlineCoopMax: number | null;
}

export interface Screenshot {
  /** Miniatura (569x320). */
  thumb: string;
  /** Tamanho grande (1920x1080 ou o maior disponível). */
  full: string;
}

/** Preço numa loja, como a IsThereAnyDeal informa. */
export interface ShopOffer {
  shop: string;
  price: Money;
  regular: Money;
  cut: number;
  /** DRM/ativação, como "Steam" ou "DRM Free". */
  drm: string[];
  url: string;
}

export interface PriceLow {
  price: Money;
  shop: string | null;
  /** Data (AAAA-MM-DD) em que o preço ocorreu, quando conhecida. */
  date: string | null;
}

export interface StoreLink {
  store: string;
  url: string;
}

/** Tudo o que a página de um jogo mostra. */
export interface GameDetails {
  id: number;
  name: string;
  slug: string;
  summary: string | null;
  storyline: string | null;
  cover: CoverImage | null;
  /** Imagem larga para o fundo do topo da página. */
  heroImage: string | null;
  releaseDate: string | null;
  rating: number | null;
  ratingCount: number;
  /** Avaliações dos jogadores na Steam (pela IsThereAnyDeal), quando existem. */
  steamReviews: { percent: number; count: number; url: string } | null;
  /** Nota da crítica (0–100), quando existe. */
  criticRating: number | null;
  genres: string[];
  themes: string[];
  modes: string[];
  perspectives: string[];
  developers: string[];
  publishers: string[];
  players: PlayerCounts | null;
  screenshots: Screenshot[];
  /** IDs de vídeos do YouTube (trailers). */
  videos: { youtubeId: string; name: string }[];
  steam: {
    appId: number;
    url: string;
    free: boolean | null;
    hasDemo: boolean | null;
    price: StorePrice | null;
  } | null;
  /** Preços em lojas, do mais barato para o mais caro (precisa da chave da IsThereAnyDeal). */
  offers: ShopOffer[];
  /** Menor preço de todos os tempos, com loja e data. */
  historyLow: PriceLow | null;
  /** Menor preço nos últimos 12 meses; data e loja quando o histórico permite saber. */
  yearLow: PriceLow | null;
  /** Páginas do jogo em lojas, pela IGDB (útil quando não há preços). */
  storeLinks: StoreLink[];
  similar: GameCard[];
  /** Quando o jogo está de graça por tempo limitado. */
  giveaway: GiveawayInfo | null;
}

/** Ordenação da busca. */
export type SearchSort = 'relevance' | 'popular' | 'rating' | 'recent';

/** Filtros da busca, como vão na URL e na API. */
export interface SearchFilters {
  q?: string;
  sort?: SearchSort;
  /** Mostra registros com o mesmo nome e edições separadas (por padrão, juntados). */
  showDuplicates?: boolean;
  /** Mínimo de jogadores juntos online. */
  players?: number;
  /** "online" (qualquer modo online, inclusive competitivo) ou "coop" (cooperativo online). */
  mode?: 'online' | 'coop';
  /** Inclui jogos sem informação de jogadores quando o filtro de jogadores está ativo. */
  unknownPlayers?: boolean;
  /**
   * Faixas de preço pela Steam: grátis, pago com demo, pago sem demo.
   * Nenhuma ou todas marcadas = sem filtro.
   */
  prices?: NewGamesCategory[];
  /** Chaves de loja (veja StoreOption). */
  stores?: string[];
  /** IDs de gênero da IGDB. */
  genres?: number[];
  yearMin?: number;
  yearMax?: number;
  ratingMin?: number;
}

/** Jogo na lista de resultados da busca. */
export interface SearchResult extends GameCard {
  /** Imagem larga para a visualização em lista. */
  artwork: string | null;
  /** Fim da promoção na Steam (AAAA-MM-DD), quando em promoção e informado. */
  promoEndsAt?: string | null;
  genres: string[];
  players: PlayerCounts | null;
}

export interface StoreOption {
  key: string;
  name: string;
}

export interface SearchFacets {
  genres: { id: number; name: string }[];
  stores: StoreOption[];
}

/** Sugestão do autocomplete. */
export interface SearchSuggestion {
  id: number;
  name: string;
  year: string | null;
  cover: string | null;
}

/** Um jogo no placar de recomendações do grupo. */
export interface RecommendationEntry {
  /** Com preço e "grátis" da Steam, quando já verificados. */
  game: GameCard;
  /** Tem demo grátis na Steam. */
  hasDemo: boolean;
  players: PlayerCounts | null;
  /** Imagem larga (arte ou screenshot da IGDB), para o destaque da home. */
  artwork?: string | null;
  /** Gêneros pela IGDB. */
  genres?: string[];
  upvotes: number;
  removeVotes: number;
  /** Se quem está vendo (pelo IP) já apoiou / pediu remoção. */
  votedUp: boolean;
  votedRemove: boolean;
  recommendedAt: string;
}

export interface RecommendationBoard {
  /** Do mais votado para o menos; no empate, o mais antigo primeiro. */
  entries: RecommendationEntry[];
  /** Pedidos de remoção necessários para tirar um jogo do placar. */
  removeThreshold: number;
  /** Recomendações ocultas pelo filtro de conteúdo. */
  hidden: number;
}

export interface RecommendationStatus {
  /** null quando o jogo não está no placar. */
  entry: RecommendationEntry | null;
  removeThreshold: number;
}

export type VoteKind = 'up' | 'remove';

/** Página de uma oferta que não tem jogo correspondente na IGDB (dados da IsThereAnyDeal). */
export interface OfferDetails {
  /** ID do jogo na IsThereAnyDeal. */
  id: string;
  title: string;
  /** Imagem larga (banner), quando existe. */
  banner: string | null;
  /** Capa vertical, quando existe. */
  boxart: string | null;
  /** Quando o jogo existe na IGDB, a página do jogo é a mais completa: o frontend redireciona. */
  igdbId: number | null;
  releaseDate: string | null;
  developers: string[];
  publishers: string[];
  tags: string[];
  steamReviews: { percent: number; count: number; url: string } | null;
  steamUrl: string | null;
  offers: ShopOffer[];
  historyLow: PriceLow | null;
  yearLow: PriceLow | null;
  giveaway: GiveawayInfo | null;
}
