/**
 * Confere se a URL pooled e a direta apontam para o mesmo banco.
 * No Neon, a pooled é igual à direta com "-pooler" no host; o nome do banco vem depois da "/".
 * Devolve uma explicação quando divergem, ou null quando batem (ou não dá para comparar).
 */
export function describeUrlMismatch(pooledUrl: string, directUrl: string | undefined): string | null {
  if (!directUrl) return null;
  let pooled: URL;
  let direct: URL;
  try {
    pooled = new URL(pooledUrl);
    direct = new URL(directUrl);
  } catch {
    return 'DATABASE_URL ou DATABASE_DIRECT_URL não é uma URL válida.';
  }

  const endpoint = (url: URL) => url.hostname.replace('-pooler.', '.');
  const database = (url: URL) => decodeURIComponent(url.pathname.replace(/^\//, ''));

  const problems: string[] = [];
  if (endpoint(pooled) !== endpoint(direct)) {
    problems.push(
      `hosts diferentes (${pooled.hostname} e ${direct.hostname}); provavelmente são de branches diferentes`,
    );
  }
  if (database(pooled) !== database(direct)) {
    problems.push(`bancos diferentes ("${database(pooled)}" e "${database(direct)}")`);
  }
  if (problems.length === 0) return null;
  return (
    `DATABASE_URL e DATABASE_DIRECT_URL apontam para lugares diferentes: ${problems.join(' e ')}. ` +
    'Copie as duas do mesmo branch e banco no Neon (botão Connect, ligando e desligando "Connection pooling").'
  );
}
