const SOURCES = [
  { name: 'IGDB', url: 'https://www.igdb.com' },
  { name: 'IsThereAnyDeal', url: 'https://isthereanydeal.com' },
  { name: 'GamerPower', url: 'https://www.gamerpower.com' },
];

/** Crédito das fontes de dados, uma vez só, no fim de toda página. */
export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-[1440px] border-t border-line px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] text-xs text-muted md:px-8">
      Dados de{' '}
      {SOURCES.map((source, i) => (
        <span key={source.name}>
          {i > 0 && (i === SOURCES.length - 1 ? ' e ' : ', ')}
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:text-ink hover:underline">
            {source.name}
          </a>
        </span>
      ))}
      .
    </footer>
  );
}
