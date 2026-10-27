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
  /** Desenho de cada card (padrão: capa). */
  renderCard?: (card: CardModel) => ReactNode;
  /** Esqueleto enquanto carrega (padrão: capa). */
  skeleton?: ReactNode;
  /** Classe extra do trilho, para outros formatos de card (ex.: cupons, 3 por vez). */
  trackClassName?: string;
}

const defaultRender = (card: CardModel) => <Card card={card} />;

/** Faixa horizontal de cards, 5 visíveis no desktop, com setas nas extremidades. */
export function CardRow({
  heading,
  cards,
  loading = false,
  children,
  renderCard = defaultRender,
  skeleton = <CardSkeleton />,
  trackClassName = '',
}: Props) {
  const track = useRef<HTMLUListElement>(null);

  return (
    <>
      <div className="mb-4">{heading}</div>
      <div className="relative">
        <ul ref={track} className={`carousel-track pb-1 ${trackClassName}`}>
          {loading || !cards
            ? Array.from({ length: 5 }, (_, i) => <li key={i}>{skeleton}</li>)
            : cards.map((card, i) => (
                <li key={card.key} className="reveal" style={{ '--i': i } as CSSProperties}>
                  {renderCard(card)}
                </li>
              ))}
        </ul>
        <EdgeArrows track={track} contentKey={cards} labels={{ previous: 'Jogos anteriores', next: 'Próximos jogos' }} />
      </div>
      {children}
    </>
  );
}
