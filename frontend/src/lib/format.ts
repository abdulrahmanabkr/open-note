export function formatRelative(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '';

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absolute = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (absolute < 45) return 'just now';
  if (absolute < 60 * 60) return formatter.format(Math.round(seconds / 60), 'minute');
  if (absolute < 60 * 60 * 24) return formatter.format(Math.round(seconds / 3600), 'hour');
  if (absolute < 60 * 60 * 24 * 30) return formatter.format(Math.round(seconds / 86400), 'day');
  if (absolute < 60 * 60 * 24 * 365) return formatter.format(Math.round(seconds / (86400 * 30)), 'month');
  return formatter.format(Math.round(seconds / (86400 * 365)), 'year');
}

export function formatDate(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatNumber(value: number): string {
  if (value >= 1000) return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  return String(value);
}

export function levelLabel(level: string | null | undefined): string {
  if (!level) return '';
  return /^\d{3}$/.test(level) ? `${level}L` : level;
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

export function clampText(text: string, max = 180): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

/** Only allow same-site relative redirects after login/register. */
export function safeNextPath(value: string | null, fallback = '/dashboard'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}
