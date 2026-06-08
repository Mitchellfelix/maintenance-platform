export default function ErrorBanner({ message }) {
  if (!message) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
      {message}
    </div>
  );
}
