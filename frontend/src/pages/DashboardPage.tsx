import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, api, assetUrl } from '../api/client';
import type { Note } from '../api/types';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { ErrorNotice } from '../components/ErrorNotice';
import {
  BookmarkIcon,
  DownloadIcon,
  EditIcon,
  EyeIcon,
  NoteIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
} from '../components/Icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatNumber, formatRelative, levelLabel } from '../lib/format';

type Tab = 'notes' | 'saved';

export function DashboardPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get('tab') === 'saved' ? 'saved' : 'notes';

  const [myNotes, setMyNotes] = useState<Note[]>([]);
  const [savedNotes, setSavedNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<{ items: Note[] }>('/notes/mine'),
      api.get<{ items: Note[] }>('/notes/bookmarks/mine'),
    ])
      .then(([mine, saved]) => {
        if (cancelled) return;
        setMyNotes(mine.items);
        setSavedNotes(saved.items);
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
  }, [reloadKey]);

  const totals = useMemo(
    () =>
      myNotes.reduce(
        (accumulator, note) => ({
          views: accumulator.views + note.viewCount,
          downloads: accumulator.downloads + note.downloadCount,
        }),
        { views: 0, downloads: 0 },
      ),
    [myNotes],
  );

  const activeNotes = tab === 'saved' ? savedNotes : myNotes;

  const handleDelete = async (note: Note) => {
    if (!window.confirm(`Delete “${note.title}”? This cannot be undone.`)) return;
    try {
      await api.delete(`/notes/${note.id}`);
      notify('Note deleted.');
      setReloadKey((key) => key + 1);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not delete the note.', 'error');
    }
  };

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'notes') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  return (
    <section className="container page-section">
      <div className="page-head">
        <div>
          <span className="eyebrow">Your corner</span>
          <h1>My dashboard</h1>
          <p>Track the notes you have published and the ones you saved for later.</p>
        </div>
        <Link to="/notes/new" className="btn btn--primary">
          <PlusIcon size={17} /> Post a note
        </Link>
      </div>

      <div className="profile-strip">
        <div className="profile-strip__identity">
          <Avatar name={user?.fullName} size="lg" />
          <div>
            <h2>{user?.fullName}</h2>
            <p>
              {[levelLabel(user?.level), user?.departmentName, user?.schoolName].filter(Boolean).join(' · ') ||
                'Add your class details to help readers find your notes.'}
            </p>
            <Link to="/profile" className="text-link">
              Edit profile →
            </Link>
          </div>
        </div>
        <div className="profile-strip__stats">
          <div>
            <strong>{myNotes.length}</strong>
            <span>notes posted</span>
          </div>
          <div>
            <strong>{formatNumber(totals.views)}</strong>
            <span>total views</span>
          </div>
          <div>
            <strong>{formatNumber(totals.downloads)}</strong>
            <span>downloads</span>
          </div>
          <div>
            <strong>{savedNotes.length}</strong>
            <span>saved</span>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button type="button" className={tab === 'notes' ? 'is-active' : ''} onClick={() => setTab('notes')}>
          <NoteIcon size={17} /> My notes <span className="tab-count">{myNotes.length}</span>
        </button>
        <button type="button" className={tab === 'saved' ? 'is-active' : ''} onClick={() => setTab('saved')}>
          <BookmarkIcon size={17} /> Saved <span className="tab-count">{savedNotes.length}</span>
        </button>
      </div>

      {error ? (
        <ErrorNotice message={error} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : loading ? (
        <div className="note-rows" aria-busy="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="note-row note-row--skeleton" key={index}>
              <div className="skeleton skeleton--row-media" />
              <div className="note-row__body">
                <div className="skeleton skeleton--line" />
                <div className="skeleton skeleton--line skeleton--short" />
              </div>
            </div>
          ))}
        </div>
      ) : activeNotes.length === 0 ? (
        <EmptyState
          icon={tab === 'saved' ? <BookmarkIcon size={30} /> : <UploadIcon size={30} />}
          title={tab === 'saved' ? 'No saved notes yet' : 'You have not posted a note yet'}
          text={
            tab === 'saved'
              ? 'Tap “Save note” on any note and it will show up here for quick access.'
              : 'Share the notes that helped you get through a course. Your classmates will thank you.'
          }
          action={
            tab === 'saved' ? (
              <Link to="/" className="btn btn--primary btn--sm">
                Browse notes
              </Link>
            ) : (
              <Link to="/notes/new" className="btn btn--primary btn--sm">
                <UploadIcon size={16} /> Post your first note
              </Link>
            )
          }
        />
      ) : (
        <div className="note-rows">
          {activeNotes.map((note) => (
            <article className="note-row" key={note.id}>
              <Link to={`/notes/${note.id}`} className="note-row__media">
                {note.coverImage ? (
                  <img src={assetUrl(note.coverImage)} alt="" loading="lazy" />
                ) : (
                  <div className="note-row__placeholder">
                    <NoteIcon size={22} />
                  </div>
                )}
              </Link>

              <div className="note-row__body">
                <div className="note-row__chips">
                  {note.courseCode ? <span className="chip chip--course">{note.courseCode}</span> : null}
                  <span className="chip">{levelLabel(note.level)}</span>
                  <span className="chip chip--plain">{note.noteTypeLabel}</span>
                  {note.status === 'hidden' ? <span className="chip chip--danger">Hidden</span> : null}
                </div>
                <h3>
                  <Link to={`/notes/${note.id}`}>{note.title}</Link>
                </h3>
                <p className="note-row__subject">
                  {note.subject} · {note.departmentName ?? 'Department'} · {formatRelative(note.createdAt)}
                </p>
                <div className="note-row__metrics">
                  <span>
                    <EyeIcon size={15} /> {formatNumber(note.viewCount)} views
                  </span>
                  <span>
                    <DownloadIcon size={15} /> {formatNumber(note.downloadCount)} downloads
                  </span>
                  <span>{note.imageCount} pages</span>
                </div>
              </div>

              <div className="note-row__actions">
                <Link to={`/notes/${note.id}`} className="btn btn--ghost btn--sm">
                  View
                </Link>
                {tab === 'notes' ? (
                  <>
                    <Link to={`/notes/${note.id}/edit`} className="btn btn--outline btn--sm">
                      <EditIcon size={15} /> Edit
                    </Link>
                    <button
                      type="button"
                      className="btn btn--danger-ghost btn--sm"
                      onClick={() => void handleDelete(note)}
                    >
                      <TrashIcon size={15} /> Delete
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
