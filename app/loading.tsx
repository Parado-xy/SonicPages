export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl animate-pulse" aria-label="Loading">
      <div className="h-5 w-24 rounded-full bg-muted" />
      <div className="mt-4 h-10 w-64 rounded-xl bg-muted" />
      <div className="mt-4 h-5 w-full max-w-lg rounded-lg bg-muted" />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-56 rounded-3xl border bg-card" />
        ))}
      </div>
    </div>
  );
}
