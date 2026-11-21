import type { ReactNode } from 'react';

export function ErrorNotice({
  message,
  onRetry,
  children,
}: {
  message: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="notice notice--error" role="alert">
      <div>
        <strong>Something went wrong</strong>
        <p>{message}</p>
        {children}
      </div>
      {onRetry ? (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
