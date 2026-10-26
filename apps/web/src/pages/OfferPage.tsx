import type { OfferDetails } from '@rj/shared';
import { useQuery } from '@tanstack/react-query';
import { SearchX } from 'lucide-react';
import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { usePreferences } from '../app/preferences';
import { ReviewBar } from '../components/gamepage/ReviewBar';
import { WhereToBuy } from '../components/gamepage/WhereToBuy';
import type { PricingData } from '../components/gamepage/PriceHistory';
import { ErrorState } from '../components/ui/ErrorState';
import { ApiError, api } from '../lib/apiClient';
import { AdultNotice, HeroBackdrop } from './GamePage';

/** O bloco de compra usa o mesmo formato da página do jogo. */
function asPricing(offer: OfferDetails): PricingData {
  return {
    name: offer.title,
    offers: offer.offers,
    historyLow: offer.historyLow,
    yearLow: offer.yearLow,
    storeLinks: [],
    giveaway: offer.giveaway,
    steam: offer.steamUrl ? { appId: 0, url: offer.steamUrl, free: null, hasDemo: null, price: null } : null,
  };
}

/** Página de uma oferta que não existe na IGDB, montada com os dados da IsThereAnyDeal. */
export function OfferPage() {
  const id = useParams().id ?? '';
  const { adultMode } = usePreferences();
  const { data: offer, isPending, isError, error, refetch } = useQuery({
    queryKey: ['offer', id, adultMode],
    queryFn: () => api.offer(id, adultMode),
    retry: (count, e) => !(e instanceof ApiError && [400, 403, 404].includes(e.status)) && count < 1,
  });

  useEffect(() => {
    document.title = offer ? `${offer.title} · GameBase` : 'GameBase';
  }, [offer]);

  if (offer?.igdbId) return <Navigate to={`/jogo/${offer.igdbId}`} replace />;
  if (isError) {
    if (error instanceof ApiError && error.code === 'adult_content') return <AdultNotice />;
    if (error instanceof ApiError && [400, 404].includes(error.status)) {
      return (
        <div className="mx-auto max-w-lg py-16 text-center">
          <SearchX className="mx-auto size-10 text-muted" aria-hidden />
          <h1 className="mt-4 font-display text-2xl font-bold">Oferta não encontrada</h1>
          <Link to="/secao/ofertas" className="mt-6 inline-block rounded-md bg-surface-2 px-4 py-2 font-semibold">
            Ver grandes ofertas
          </Link>
        </div>
      );
    }
    return <ErrorState message={error.message} onRetry={() => void refetch()} />;
  }
  if (isPending || !offer) return <div aria-busy className="skeleton h-80 rounded-md" />;

  const year = offer.releaseDate?.slice(0, 4);
  const byline = [year, offer.developers[0]].filter(Boolean).join(' · ');

  return (
    <article className="relative space-y-8">
      <HeroBackdrop image={offer.banner} />
      <header>
        <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">{offer.title}</h1>
        {byline && <p className="mt-1 text-muted">{byline}</p>}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <div className="min-w-0">
          <WhereToBuy game={asPricing(offer)} />
        </div>
        <aside className="space-y-5 rounded-md border border-line bg-surface p-4">
          {(offer.banner ?? offer.boxart) && (
            <img src={offer.banner ?? offer.boxart!} alt="" className="w-full rounded-md object-cover" />
          )}
          {offer.steamReviews && <ReviewBar {...offer.steamReviews} />}
          {offer.publishers.length > 0 && (
            <p className="text-sm">
              <span className="text-muted">Publicação: </span>
              {offer.publishers.join(', ')}
            </p>
          )}
          {offer.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
              {offer.tags.slice(0, 10).map((tag) => (
                <li key={tag} className="rounded-sm bg-surface-2 px-2 py-1 text-xs font-semibold">
                  {tag}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted">Este jogo não foi encontrado na IGDB; os dados vêm da IsThereAnyDeal.</p>
        </aside>
      </div>
    </article>
  );
}
