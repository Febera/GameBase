/** Aviso de que a lista ainda vai crescer enquanto o servidor verifica jogos na Steam. */
export function PendingNote({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <p role="status" className="mt-3 text-sm text-muted">
      Ainda verificando preço e demo de {count} {count === 1 ? 'jogo' : 'jogos'} na Steam. A lista
      se atualiza sozinha nos próximos minutos.
    </p>
  );
}
