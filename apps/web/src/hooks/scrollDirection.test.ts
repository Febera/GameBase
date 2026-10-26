import { describe, expect, it } from 'vitest';
import { nextScrollState } from './scrollDirection';

describe('nextScrollState', () => {
  it('fica visível perto do topo', () => {
    expect(nextScrollState({ lastY: 300, hidden: true }, 40).hidden).toBe(false);
  });

  it('esconde ao descer e mostra ao subir', () => {
    let state = nextScrollState({ lastY: 100, hidden: false }, 200);
    expect(state.hidden).toBe(true);
    state = nextScrollState(state, 180);
    expect(state.hidden).toBe(false);
  });

  it('ignora movimentos menores que o limite', () => {
    const state = { lastY: 500, hidden: true };
    expect(nextScrollState(state, 495)).toBe(state);
  });

  it('acumula movimentos pequenos até passar do limite', () => {
    let state = { lastY: 500, hidden: true };
    state = nextScrollState(state, 496);
    state = nextScrollState(state, 491);
    expect(state.hidden).toBe(false);
  });
});
