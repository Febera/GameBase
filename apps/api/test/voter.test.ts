import { describe, expect, it } from 'vitest';
import { normalizeIp, voterId } from '../src/lib/voter.js';

describe('voter', () => {
  it('trata IPv4 mapeado em IPv6 como o mesmo IP', () => {
    expect(normalizeIp('::ffff:200.1.2.3')).toBe('200.1.2.3');
    expect(voterId('::ffff:200.1.2.3', 's')).toBe(voterId('200.1.2.3', 's'));
    expect(normalizeIp('2001:DB8::1')).toBe('2001:db8::1');
  });

  it('muda com o sal e não expõe o IP', () => {
    expect(voterId('1.2.3.4', 'a')).not.toBe(voterId('1.2.3.4', 'b'));
    expect(voterId('1.2.3.4', 'a')).toMatch(/^[0-9a-f]{32}$/);
  });
});
