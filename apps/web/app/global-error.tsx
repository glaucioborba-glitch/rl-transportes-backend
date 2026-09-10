"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-zinc-950 px-6 py-16 text-zinc-100">
        <main className="mx-auto max-w-lg space-y-4">
          <h1 className="text-xl font-semibold">Não foi possível carregar a página</h1>
          <p className="text-sm text-zinc-400">
            {error.message || "Erro inesperado. Tente novamente."}
          </p>
          <button
            type="button"
            className="rounded-md bg-cyan-700 px-4 py-2 text-sm text-white hover:bg-cyan-600"
            onClick={() => reset()}
          >
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
