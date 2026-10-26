import { describe, expect, it } from 'vitest';
import { describeUrlMismatch } from '../src/db/urls.js';

const pooled = 'postgresql://u:p@ep-cool-123-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require';
const direct = 'postgresql://u:p@ep-cool-123.sa-east-1.aws.neon.tech/neondb?sslmode=require';

describe('describeUrlMismatch', () => {
  it('aceita a pooled e a direta do mesmo branch', () => {
    expect(describeUrlMismatch(pooled, direct)).toBeNull();
    expect(describeUrlMismatch(pooled, undefined)).toBeNull();
  });

  it('aponta branches diferentes', () => {
    const other = direct.replace('ep-cool-123', 'ep-dark-999');
    expect(describeUrlMismatch(pooled, other)).toContain('branches diferentes');
  });

  it('aponta bancos diferentes', () => {
    expect(describeUrlMismatch(pooled, direct.replace('/neondb', '/outro'))).toContain('bancos diferentes');
  });

  it('avisa sobre URL inválida', () => {
    expect(describeUrlMismatch('não é url', direct)).toContain('não é uma URL válida');
  });
});
