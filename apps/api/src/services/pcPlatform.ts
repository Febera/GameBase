/** ID da plataforma "PC (Microsoft Windows)" na IGDB. */
export const PC_PLATFORM_ID = 6;
/** ID da Steam como fonte em external_games. */
export const STEAM_SOURCE = 1;

/**
 * Condição Apicalypse de "jogo de PC": a IGDB diz que é de PC, ou o jogo tem página na Steam.
 * Cadastros recentes às vezes chegam sem plataforma (ex.: jogos ainda não lançados, só com
 * demo); ter página na Steam já basta para ser de PC.
 * `sourceField` é o nome do campo da fonte: "external_game_source" (atual) ou "category" (antigo).
 */
export function pcCondition(sourceField = 'external_game_source'): string {
  return `(platforms = (${PC_PLATFORM_ID}) | external_games.${sourceField} = ${STEAM_SOURCE})`;
}
