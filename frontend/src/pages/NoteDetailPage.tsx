import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, api, assetUrl } from '../api/client';
import type { Note, Paginated } from '../api/types';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { ErrorNotice } from '../components/ErrorNotice';
import {
  ArrowLeftIcon,
  BookmarkIcon,
  ClockIcon,
  DownloadIcon,
  EditIcon,
  EyeIcon,
  NoteIcon,
  ShareIcon,
  TrashIcon,
} from '../components/Icons';
import { Lightbox } from '../components/Lightbox';
import { NoteCard } from '../components/NoteCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDateTime, formatNumber, formatRelative, levelLabel } from '../lib/format';

export function NoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { notify } = useToast();

  const [note, setNote] = useState<Note | null>(null);
  const [related, setRelated] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setActivePage(0);

    api
      .get<{ note: Note }>(`/notes/${id}`)
      .then(({ note: loaded }) => {
        if (cancelled) return;
        setNote(loaded);
        if (loaded.departmentId) {
          api
            .get<Paginated<Note>>('/notes', { departmentId: loaded.departmentId, limit: 4 })
            .then((data) => {
              if (!cancelled) setRelated(data.items.filter((item) => item.id !== loaded.id).slice(0, 3));
            })
            .catch(() => undefined);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const images = note?.images ?? [];
  const currentImage = images[activePage];
  const isOwner = Boolean(user && note && note.publisher.id === user.id);

  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swipeHandled = useRef(false);

  const startSwipe = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'touch') return;
    swipeStart.current = { x: event.clientX, y: event.clientY };
    swipeHandled.current = false;
  };

  const moveSwipe = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = swipeStart.current;
    if (!start || event.pointerType !== 'touch' || images.length < 2) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      swipeStart.current = null;
      swipeHandled.current = true;
      setActivePage((current) => (current + (dx < 0 ? 1 : -1) + images.length) % images.length);
    }
  };

  const endSwipe = () => {
    swipeStart.current = null;
  };

  const openPreview = () => {
    if (swipeHandled.current) {
      swipeHandled.current = false;
      return;
    }
    setLightboxOpen(true);
  };

  const publishedLabel = useMemo(() => {
    if (!note) return '';
    return `${formatRelative(note.createdAt)} · ${formatDateTime(note.createdAt)}`;
  }, [note]);

  const toggleBookmark = async () => {
    if (!note) return;
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/notes/${note.id}`)}`);
      return;
    }
    setSaving(true);
    try {
      if (note.isBookmarked) {
        await api.delete(`/notes/${note.id}/bookmark`);
        setNote({ ...note, isBookmarked: false });
        notify('Removed from your saved notes.');
      } else {
        await api.post(`/notes/${note.id}/bookmark`);
        setNote({ ...note, isBookmarked: true });
        notify('Saved to your dashboard.');
      }
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not update your saved notes.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify('Link copied to your clipboard.');
    } catch {
      notify('Copy this page URL from your browser to share it.', 'info');
    }
  };

  const deleteNote = async () => {
    if (!note) return;
    if (!window.confirm('Delete this note and all its pages? This cannot be undone.')) return;
    try {
      await api.delete(`/notes/${note.id}`);
      notify('Note deleted.');
      navigate('/dashboard');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not delete the note.', 'error');
    }
  };

  if (loading) {
    return (
      <section className="container page-section">
        <div className="page-loader" role="status">
          <span className="spinner" />
          <span>Opening note…</span>
        </div>
      </section>
    );
  }

  if (error || !note) {
    return (
      <section className="container page-section">
        <ErrorNotice message={error ?? 'Note not found.'} onRetry={() => setReloadKey((key) => key + 1)} />
        <Link to="/" className="btn btn--ghost">
          <ArrowLeftIcon size={17} /> Back to all notes
        </Link>
      </section>
    );
  }

  return (
    <section className="container page-section">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Notes</Link>
        <span>/</span>
        <Link to={`/?departmentId=${note.departmentId ?? ''}`}>{note.departmentName ?? 'Department'}</Link>
        <span>/</span>
        <span>{note.courseCode ?? note.subject}</span>
      </nav>

      <div className="detail-head">
        <div className="detail-head__main">
          <div className="detail-head__chips">
            {note.courseCode ? <span className="chip chip--course">{note.courseCode}</span> : null}
            <span className="chip">{levelLabel(note.level)}</span>
            <span className="chip chip--plain">{note.noteTypeLabel}</span>
            {note.status === 'hidden' ? <span className="chip chip--danger">Hidden</span> : null}
          </div>
          <h1>{note.title}</h1>
          <p className="detail-head__subject">{note.subject}</p>
          {note.description ? <p className="detail-head__description">{note.description}</p> : null}

          <div className="detail-head__meta">
            <div className="detail-head__author">
              <Avatar name={note.publisher.fullName} />
              <div>
                <strong>{note.publisher.fullName}</strong>
                <span>
                  {[levelLabel(note.publisher.level), note.publisher.departmentName].filter(Boolean).join(' · ')}
                </span>
              </div>
            </div>
            <span className="meta-divider" />
            <span className="meta-item">
              <ClockIcon size={16} /> Published {publishedLabel}
            </span>
            <span className="meta-item">
              <EyeIcon size={16} /> {formatNumber(note.viewCount)} views
            </span>
            <span className="meta-item">
              <DownloadIcon size={16} /> {formatNumber(note.downloadCount)} downloads
            </span>
          </div>
        </div>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          {images.length > 0 ? (
            <>
              <div className="viewer">
                <div className="viewer__topbar">
                  <span>
                    Page {activePage + 1} of {images.length}
                  </span>
                  <div className="viewer__actions">
                    {currentImage ? (
                      <a
                        className="btn btn--ghost btn--sm"
                        href={assetUrl(`/api/notes/${note.id}/images/${currentImage.id}/download`)}
                      >
                        <DownloadIcon size={16} /> Download page
                      </a>
                    ) : null}
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setLightboxOpen(true)}>
                      Expand
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="viewer__stage"
                  onClick={openPreview}
                  onPointerDown={startSwipe}
                  onPointerMove={moveSwipe}
                  onPointerUp={endSwipe}
                  onPointerCancel={endSwipe}
                >
                  {currentImage ? (
                    <img src={assetUrl(currentImage.path)} alt={`${note.title} — page ${activePage + 1}`} />
                  ) : null}
                </button>
              </div>

              {images.length > 1 ? (
                <div className="viewer__thumbs">
                  {images.map((image, index) => (
                    <button
                      key={image.id}
                      type="button"
                      className={`viewer__thumb ${index === activePage ? 'is-active' : ''}`}
                      onClick={() => setActivePage(index)}
                      aria-label={`View page ${index + 1}`}
                    >
                      <img src={assetUrl(image.path)} alt="" />
                      <span>{index + 1}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState
              icon={<NoteIcon size={30} />}
              title="This note has no pages"
              text="The publisher has not uploaded any images yet."
            />
          )}

          <div className="detail-note-box">
            <h3>About this note</h3>
            <p>{note.description || 'The publisher did not add a description. Open the pages to see the content.'}</p>
            <div className="detail-actions">
              <button type="button" className="btn btn--outline btn--sm" onClick={toggleBookmark} disabled={saving}>
                <BookmarkIcon size={16} filled={note.isBookmarked} />
                {note.isBookmarked ? 'Saved' : 'Save note'}
              </button>
              <button type="button" className="btn btn--outline btn--sm" onClick={share}>
                <ShareIcon size={16} /> Copy link
              </button>
              {(isOwner || isAdmin) ? (
                <>
                  <Link to={`/notes/${note.id}/edit`} className="btn btn--outline btn--sm">
                    <EditIcon size={16} /> Edit
                  </Link>
                  <button type="button" className="btn btn--danger-ghost btn--sm" onClick={deleteNote}>
                    <TrashIcon size={16} /> Delete
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="detail-aside">
          <div className="publisher-card">
            <div className="publisher-card__top">
              <Avatar name={note.publisher.fullName} size="lg" />
              <div>
                <span className="eyebrow">Published by</span>
                <h3>{note.publisher.fullName}</h3>
                {note.publisher.role !== 'student' ? (
                  <span className={`role-pill role-pill--${note.publisher.role}`}>{note.publisher.role}</span>
                ) : null}
              </div>
            </div>
            <div className="publisher-card__rows">
              <div>
                <span>Level / class</span>
                <strong>{levelLabel(note.publisher.level) || 'Not stated'}</strong>
              </div>
              <div>
                <span>Department</span>
                <strong>{note.publisher.departmentName ?? note.departmentName ?? 'Not stated'}</strong>
              </div>
              <div>
                <span>Published</span>
                <strong>{formatDateTime(note.createdAt)}</strong>
              </div>
            </div>
            <Link to={`/?publisherId=${note.publisher.id}`} className="btn btn--soft btn--sm btn--block">
              More notes from this publisher
            </Link>
          </div>

          <div className="detail-facts">
            <h3>Note details</h3>
            <dl>
              <div>
                <dt>Course</dt>
                <dd>{note.courseCode ?? '—'}</dd>
              </div>
              <div>
                <dt>Subject</dt>
                <dd>{note.subject}</dd>
              </div>
              <div>
                <dt>Department</dt>
                <dd>{note.departmentName ?? '—'}</dd>
              </div>
              <div>
                <dt>School</dt>
                <dd>{note.schoolName ?? '—'}</dd>
              </div>
              <div>
                <dt>Level</dt>
                <dd>{levelLabel(note.level)}</dd>
              </div>
              <div>
                <dt>Session</dt>
                <dd>{note.academicSession ?? '—'}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{note.noteTypeLabel}</dd>
              </div>
              <div>
                <dt>Pages</dt>
                <dd>{images.length}</dd>
              </div>
            </dl>
          </div>

          <div className="aside-cta aside-cta--soft">
            <h4>Found this useful?</h4>
            <p>Post one of your own notes and keep the library growing.</p>
            <Link to="/notes/new" className="text-link">
              Share a note →
            </Link>
          </div>
        </aside>
      </div>

      {related.length > 0 ? (
        <section className="related">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Keep studying</span>
              <h2>More from {note.departmentName ?? 'this department'}</h2>
            </div>
          </div>
          <div className="note-grid note-grid--three">
            {related.map((item) => (
              <NoteCard key={item.id} note={item} />
            ))}
          </div>
        </section>
      ) : null}

      {lightboxOpen && images.length > 0 ? (
        <Lightbox
          images={images}
          index={activePage}
          title={note.title}
          onClose={() => setLightboxOpen(false)}
          onChange={setActivePage}
        />
      ) : null}
    </section>
  );
}
