"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-lg px-6 py-16 text-zinc-100">
      <h1 className="text-xl font-semibold">Algo deu errado</h1>
      <p className="mt-2 text-sm text-zinc-400">{error.message || "Falha ao renderizar esta tela."}</p>
      <button
        type="button"
        className="mt-6 rounded-md bg-cyan-700 px-4 py-2 text-sm text-white hover:bg-cyan-600"
        onClick={() => reset()}
      >
        Tentar de novo
      </button>
    </main>
  );
}
