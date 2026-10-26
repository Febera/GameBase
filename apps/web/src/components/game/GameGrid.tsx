import type { CSSProperties } from 'react';
import type { CardModel } from '../../lib/cards';
import { Card, CardSkeleton } from './Card';

interface Props {
  cards: CardModel[];
  /** Quantos esqueletos mostrar no fim enquanto a próxima página carrega. */
  loadingCount?: number;
}

export function GameGrid({ cards, loadingCount = 0 }: Props) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4 sm:grid-cols-[repeat(auto-fill,minmax(176px,1fr))] lg:gap-5">
      {cards.map((card, i) => (
        <li key={card.key} className="reveal" style={{ '--i': i % 24 } as CSSProperties}>
          <Card card={card} />
        </li>
      ))}
      {Array.from({ length: loadingCount }, (_, i) => (
        <li key={`skeleton-${i}`}>
          <CardSkeleton />
        </li>
      ))}
    </ul>
  );
}
