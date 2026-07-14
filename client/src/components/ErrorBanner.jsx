export default function ErrorBanner({ message }) {
  if (!message) return null;

  return (
    <div className="rounded-2xl border border-amber-800/80 bg-amber-950/50 p-4 text-amber-100">
      {message}
    </div>
  );
}
