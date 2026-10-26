import { type CSSProperties, type ReactNode, useRef } from 'react';
import type { CardModel } from '../../lib/cards';
import { Card, CardSkeleton } from './Card';
import { EdgeArrows } from './EdgeArrows';

interface Props {
  /** Título da faixa (já com o link, se houver). */
  heading: ReactNode;
  cards: CardModel[] | undefined;
  loading?: boolean;
  /** Conteúdo exibido abaixo do trilho (avisos). */
  children?: ReactNode;
}

/** Faixa horizontal de cards, 5 visíveis no desktop, com setas nas extremidades. */
export function CardRow({ heading, cards, loading = false, children }: Props) {
  const track = useRef<HTMLUListElement>(null);

  return (
    <>
      <div className="mb-4">{heading}</div>
      <div className="relative">
        <ul ref={track} className="carousel-track pb-1">
          {loading || !cards
            ? Array.from({ length: 5 }, (_, i) => (
                <li key={i}>
                  <CardSkeleton />
                </li>
              ))
            : cards.map((card, i) => (
                <li key={card.key} className="reveal" style={{ '--i': i } as CSSProperties}>
                  <Card card={card} />
                </li>
              ))}
        </ul>
        <EdgeArrows track={track} contentKey={cards} labels={{ previous: 'Jogos anteriores', next: 'Próximos jogos' }} />
      </div>
      {children}
    </>
  );
}
