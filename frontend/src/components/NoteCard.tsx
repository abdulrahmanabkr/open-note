import { Link } from 'react-router-dom';
import { assetUrl } from '../api/client';
import type { Note } from '../api/types';
import { formatRelative, formatNumber, levelLabel } from '../lib/format';
import { Avatar } from './Avatar';
import { BookmarkIcon, EyeIcon } from './Icons';

export function NoteCard({ note, saved = false }: { note: Note; saved?: boolean }) {
  return (
    <article className="note-card">
      <Link to={`/notes/${note.id}`} className="note-card__link" aria-label={`Open ${note.title}`}>
        <div className="note-card__media">
          {note.coverImage ? (
            <img src={assetUrl(note.coverImage)} alt="" loading="lazy" />
          ) : (
            <div className="note-card__placeholder">No preview</div>
          )}
          <span className="badge badge--type">{note.noteTypeLabel}</span>
          {saved ? (
            <span className="badge badge--saved" title="Saved to your bookmarks">
              <BookmarkIcon size={13} filled /> Saved
            </span>
          ) : null}
          {note.imageCount > 1 ? <span className="badge badge--pages">{note.imageCount} pages</span> : null}
        </div>

        <div className="note-card__body">
          <div className="note-card__chips">
            {note.courseCode ? <span className="chip chip--course">{note.courseCode}</span> : null}
            <span className="chip">{levelLabel(note.level)}</span>
            {note.departmentName ? <span className="chip chip--plain">{note.departmentName}</span> : null}
          </div>

          <h3 className="note-card__title">{note.title}</h3>
          <p className="note-card__subject">{note.subject}</p>

          <div className="note-card__footer">
            <div className="note-card__author">
              <Avatar name={note.publisher.fullName} size="sm" />
              <div>
                <strong>{note.publisher.fullName}</strong>
                <span>{formatRelative(note.createdAt)}</span>
              </div>
            </div>
            <span className="note-card__views" title={`${note.viewCount} views`}>
              <EyeIcon size={16} /> {formatNumber(note.viewCount)}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
