import { initials } from '../lib/format';

interface AvatarProps {
  name: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  tone?: number;
}

export function Avatar({ name, size = 'md', tone }: AvatarProps) {
  const palette = ['sage', 'amber', 'clay', 'indigo', 'sand'];
  const index = tone ?? (name ? name.charCodeAt(0) % palette.length : 0);
  return (
    <span className={`avatar avatar--${size} avatar--${palette[index]}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
