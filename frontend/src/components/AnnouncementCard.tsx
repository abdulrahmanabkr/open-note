import type { Announcement } from '../api/types';
import { clampText, formatRelative } from '../lib/format';
import { PinIcon } from './Icons';

export function AnnouncementCard({
  announcement,
  compact = false,
}: {
  announcement: Announcement;
  compact?: boolean;
}) {
  return (
    <article className={`announcement ${compact ? 'announcement--compact' : ''}`}>
      <div className="announcement__top">
        <span className={`category category--${announcement.category}`}>{announcement.categoryLabel}</span>
        {announcement.isPinned ? (
          <span className="announcement__pinned">
            <PinIcon size={13} /> Pinned
          </span>
        ) : null}
      </div>
      <h3>{announcement.title}</h3>
      <p>{compact ? clampText(announcement.body, 120) : clampText(announcement.body, 340)}</p>
      <footer>
        <span>{announcement.author?.fullName ?? 'OpenNote team'}</span>
        <span className="dot" />
        <time dateTime={announcement.createdAt}>{formatRelative(announcement.createdAt)}</time>
      </footer>
    </article>
  );
}
