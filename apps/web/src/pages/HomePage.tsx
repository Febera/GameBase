import { useEffect } from 'react';
import { GameCarousel } from '../components/game/GameCarousel';
import { GameGridSection } from '../components/game/GameGridSection';
import { SECTIONS } from '../lib/sections';

export function HomePage() {
  useEffect(() => {
    document.title = 'GameBase';
  }, []);

  return (
    <>
      <h1 className="sr-only">Descobrir jogos</h1>
      {SECTIONS.map((section) =>
        section.layout === 'grid' ? (
          <GameGridSection key={section.slug} section={section} />
        ) : (
          <GameCarousel key={section.slug} section={section} />
        ),
      )}
    </>
  );
}
