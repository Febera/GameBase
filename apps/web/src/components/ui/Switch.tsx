interface Props {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

/** Interruptor liga/desliga acessível (role="switch"). */
export function Switch({ id, checked, onChange, label, description }: Props) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        {description && (
          <p id={`${id}-descricao`} className="mt-1 max-w-prose text-sm text-muted">
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-descricao` : undefined}
        onClick={() => onChange(!checked)}
        className={[
          'relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors duration-150',
          checked ? 'bg-brand-b' : 'bg-surface-2 ring-1 ring-line',
        ].join(' ')}
      >
        <span
          aria-hidden
          className={[
            'absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform duration-150',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </div>
  );
}
