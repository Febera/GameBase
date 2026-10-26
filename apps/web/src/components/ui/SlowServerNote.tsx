/** Aviso mostrado quando o carregamento demora (servidor gratuito acordando). */
export function SlowServerNote() {
  return (
    <p role="status" className="mt-3 text-sm text-muted">
      O servidor estava em repouso e está acordando. Isso pode levar até 1 minuto.
    </p>
  );
}
