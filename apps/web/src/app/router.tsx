import { createBrowserRouter } from 'react-router';
import { AppLayout } from '../components/layout/AppLayout';
import { GamePage } from '../pages/GamePage';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { OfferPage } from '../pages/OfferPage';
import { RecommendationsPage } from '../pages/RecommendationsPage';
import { SearchPage } from '../pages/SearchPage';
import { SectionPage } from '../pages/SectionPage';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'secao/:slug', element: <SectionPage /> },
      { path: 'jogo/:id', element: <GamePage /> },
      { path: 'oferta/:id', element: <OfferPage /> },
      { path: 'busca', element: <SearchPage /> },
      { path: 'recomendacoes', element: <RecommendationsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
