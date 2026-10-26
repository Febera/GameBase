import { Link } from 'react-router';

interface Props {
  title: string;
  description: string;
}

/** Página provisória para telas que chegam nas próximas etapas. */
export function ComingSoon({ title, description }: Props) {
  return (
    <div className="max-w-xl py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 text-muted">{description}</p>
      <Link to="/" className="mt-6 inline-block font-semibold text-brand-b hover:underline">
        Voltar ao início
      </Link>
    </div>
  );
}
