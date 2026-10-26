import { createHash } from 'node:crypto';

/** IPv4 mapeado em IPv6 ("::ffff:1.2.3.4") vira o IPv4 puro, para contar como o mesmo IP. */
export function normalizeIp(ip: string): string {
  const trimmed = ip.trim().toLowerCase();
  return trimmed.startsWith('::ffff:') && trimmed.includes('.') ? trimmed.slice(7) : trimmed;
}

/**
 * Identificador do votante: hash do IP com um "sal" secreto.
 * O IP em si nunca é guardado, e sem o sal não dá para descobrir o IP a partir do hash.
 */
export function voterId(ip: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${normalizeIp(ip)}`).digest('hex').slice(0, 32);
}
