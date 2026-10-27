import type { SearchFilters } from '@rj/shared';

export interface QuickSearch {
  key: string;
  label: string;
  description: string;
  filters: SearchFilters;
}

/** Atalhos prontos do painel que abre ao focar a busca vazia: só preenchem filtros existentes. */
export const QUICK_SEARCHES: QuickSearch[] = [
  { key: 'coop4', label: 'Coop online para 4+', description: 'Jogos cooperativos para o grupo', filters: { players: 4, mode: 'coop' } },
  { key: 'online8', label: '8+ jogadores online', description: 'Para quando todo mundo está on', filters: { players: 8 } },
  { key: 'free', label: 'Grátis para jogar', description: 'Free-to-play e de graça agora', filters: { prices: ['free'] } },
  { key: 'demo', label: 'Pagos com demo grátis', description: 'Teste antes de comprar', filters: { prices: ['demo'] } },
  { key: 'recent', label: 'Lançamentos recentes', description: 'Do mais novo para o mais antigo', filters: { sort: 'recent' } },
  { key: 'rated', label: 'Mais bem avaliados', description: 'Steam, 500+ avaliações', filters: { sort: 'rating' } },
];
