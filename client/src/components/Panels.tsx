export function ErrorMessage({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <div className="error-message" role="alert">
      <span>{message}</span>
      <button aria-label="Dismiss error" onClick={onDismiss}>×</button>
    </div>
  );
}
