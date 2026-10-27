import { useEffect } from 'react';
import { GameCarousel } from '../components/game/GameCarousel';
import { GameGridSection } from '../components/game/GameGridSection';
import { GroupHero } from '../components/home/GroupHero';
import { QuickTiles } from '../components/home/QuickTiles';
import { SectionArt } from '../components/home/SectionArt';
import { SECTIONS, type SectionDef } from '../lib/sections';

/** Junta seções vizinhas que usam a mesma ilustração de fundo (ex.: grátis + ofertas). */
function groupByArt(sections: SectionDef[]): SectionDef[][] {
  const groups: SectionDef[][] = [];
  for (const section of sections) {
    const last = groups.at(-1);
    if (last && last[0]!.art === section.art) last.push(section);
    else groups.push([section]);
  }
  return groups;
}

function HomeSection({ section, withArt }: { section: SectionDef; withArt: boolean }) {
  return section.layout === 'grid' ? (
    <GameGridSection section={section} withArt={withArt} />
  ) : (
    <GameCarousel section={section} withArt={withArt} />
  );
}

export function HomePage() {
  useEffect(() => {
    document.title = 'GameBase';
  }, []);

  return (
    <>
      <h1 className="sr-only">Descobrir jogos</h1>
      <GroupHero />
      <QuickTiles />
      {groupByArt(SECTIONS).map((group) =>
        group.length === 1 ? (
          <HomeSection key={group[0]!.slug} section={group[0]!} withArt />
        ) : (
          // Uma ilustração só, atrás do grupo todo.
          <div key={group.map((s) => s.slug).join('+')} className="relative isolate">
            <SectionArt kind={group[0]!.art} />
            {group.map((section) => (
              <HomeSection key={section.slug} section={section} withArt={false} />
            ))}
          </div>
        ),
      )}
    </>
  );
}
