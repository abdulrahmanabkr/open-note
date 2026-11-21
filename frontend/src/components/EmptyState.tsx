import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon, title, text, action, compact = false }: EmptyStateProps) {
  return (
    <div className={`empty ${compact ? 'empty--compact' : ''}`}>
      {icon ? <span className="empty__icon">{icon}</span> : null}
      <h3>{title}</h3>
      {text ? <p>{text}</p> : null}
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  );
}
