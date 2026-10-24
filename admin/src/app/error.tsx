'use client';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-2xl font-bold">Une erreur est survenue</h1>
      <p className="mt-2 text-sm text-slate-600">Réessayez ; si le problème persiste, vérifiez les variables d’environnement et la connexion à Supabase.</p>
      <button onClick={reset} className="btn btn-primary mt-6">Réessayer</button>
    </main>
  );
}
