import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import { Footer } from './Footer';
import { TopBar } from './TopBar';

export function AppLayout() {
  const location = useLocation();
  return (
    <>
      <TopBar />
      <main
        id="conteudo"
        className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-[calc(5.5rem+env(safe-area-inset-top,0px))] md:px-8"
      >
        {/* A chave reinicia a animação de entrada a cada troca de página (não a cada filtro). */}
        <div key={location.pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
      <Footer />
      <ScrollRestoration />
    </>
  );
}
