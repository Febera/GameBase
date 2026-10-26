/**
 * Tradução dos nomes que a IGDB usa para gêneros, temas, modos e perspectivas.
 * Nomes não listados aparecem como vieram.
 */
const LABELS: Record<string, string> = {
  // Gêneros
  'Adventure': 'Aventura',
  'Arcade': 'Arcade',
  'Card & Board Game': 'Cartas e tabuleiro',
  'Fighting': 'Luta',
  "Hack and slash/Beat 'em up": 'Hack and slash',
  'Indie': 'Indie',
  'MOBA': 'MOBA',
  'Music': 'Música',
  'Pinball': 'Pinball',
  'Platform': 'Plataforma',
  'Point-and-click': 'Point-and-click',
  'Puzzle': 'Quebra-cabeça',
  'Quiz/Trivia': 'Quiz',
  'Racing': 'Corrida',
  'Real Time Strategy (RTS)': 'Estratégia em tempo real',
  'Role-playing (RPG)': 'RPG',
  'Shooter': 'Tiro',
  'Simulator': 'Simulação',
  'Sport': 'Esporte',
  'Strategy': 'Estratégia',
  'Tactical': 'Tático',
  'Turn-based strategy (TBS)': 'Estratégia por turnos',
  'Visual Novel': 'Visual novel',
  // Temas
  'Action': 'Ação',
  'Business': 'Negócios',
  'Comedy': 'Comédia',
  'Drama': 'Drama',
  'Educational': 'Educativo',
  'Fantasy': 'Fantasia',
  'Historical': 'Histórico',
  'Horror': 'Terror',
  'Kids': 'Infantil',
  'Mystery': 'Mistério',
  'Non-fiction': 'Não ficção',
  'Open world': 'Mundo aberto',
  'Party': 'Festa',
  'Romance': 'Romance',
  'Sandbox': 'Sandbox',
  'Science fiction': 'Ficção científica',
  'Stealth': 'Furtividade',
  'Survival': 'Sobrevivência',
  'Thriller': 'Suspense',
  'Warfare': 'Guerra',
  '4X (explore, expand, exploit, and exterminate)': '4X',
  // Modos
  'Single player': 'Um jogador',
  'Multiplayer': 'Multijogador',
  'Co-operative': 'Cooperativo',
  'Split screen': 'Tela dividida',
  'Massively Multiplayer Online (MMO)': 'MMO',
  'Battle Royale': 'Battle royale',
  // Perspectivas
  'First person': 'Primeira pessoa',
  'Third person': 'Terceira pessoa',
  'Bird view / Isometric': 'Visão aérea / isométrica',
  'Side view': 'Visão lateral',
  'Text': 'Texto',
  'Auditory': 'Áudio',
  'Virtual Reality': 'Realidade virtual',
};

export function label(name: string): string {
  return LABELS[name] ?? name;
}
