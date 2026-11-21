import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Announcement, Note, Paginated, PublicStats, Taxonomy } from '../api/types';
import { AnnouncementCard } from '../components/AnnouncementCard';
import { EmptyState } from '../components/EmptyState';
import { ErrorNotice } from '../components/ErrorNotice';
import { BookIcon, MegaphoneIcon, NoteIcon, SearchIcon, UploadIcon, UsersIcon, DownloadIcon } from '../components/Icons';
import { NoteCard } from '../components/NoteCard';
import { NoteFilters, type FilterValues } from '../components/NoteFilters';
import { Pagination } from '../components/Pagination';
import { useAuth } from '../context/AuthContext';
import { formatNumber } from '../lib/format';

const PAGE_SIZE = 9;

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const filters = useMemo<FilterValues>(
    () => ({
      schoolId: searchParams.get('schoolId') ?? '',
      departmentId: searchParams.get('departmentId') ?? '',
      level: searchParams.get('level') ?? '',
      noteType: searchParams.get('noteType') ?? '',
      sort: searchParams.get('sort') ?? 'newest',
    }),
    [searchParams],
  );

  const q = searchParams.get('q') ?? '';
  const publisherId = searchParams.get('publisherId') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  const [query, setQuery] = useState(q);
  const [notes, setNotes] = useState<Paginated<Note> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setQuery(q);
  }, [q]);

  useEffect(() => {
    api.get<Taxonomy>('/taxonomy').then(setTaxonomy).catch(() => undefined);
    api
      .get<{ items: Announcement[] }>('/announcements', { limit: 3 })
      .then((data) => setAnnouncements(data.items))
      .catch(() => undefined);
    api.get<PublicStats>('/stats').then(setStats).catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(() => {
      api
        .get<Paginated<Note>>('/notes', {
          q,
          schoolId: filters.schoolId,
          departmentId: filters.departmentId,
          level: filters.level,
          noteType: filters.noteType,
          sort: filters.sort,
          publisherId,
          page,
          limit: PAGE_SIZE,
        })
        .then((data) => {
          if (!cancelled) setNotes(data);
        })
        .catch((err: Error) => {
          if (!cancelled) setError(err.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q, filters, page, publisherId, reloadKey]);

  const updateParams = (patch: Record<string, string | undefined>, resetPage = true) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(patch)) {
          if (!value) next.delete(key);
          else next.set(key, value);
        }
        if (resetPage && !('page' in patch)) next.delete('page');
        return next;
      },
      { replace: true },
    );
  };

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    updateParams({ q: query.trim() || undefined });
  };

  const activeLabel = useMemo(() => {
    if (publisherId) return 'Notes from this publisher';
    const parts = [q, filters.level && `${filters.level}L`, filters.noteType.replace('_', ' ')].filter(Boolean);
    return parts.length > 0 ? `Results for ${parts.join(' · ')}` : 'Latest notes across campus';
  }, [q, filters.level, filters.noteType, publisherId]);

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <div className="hero__copy">
            <span className="eyebrow">Student-built · campus-wide</span>
            <h1>
              Every lecture note,
              <br />
              <em>one shared library.</em>
            </h1>
            <p>
              OpenNote is where students post the notes that actually helped them — lecture notes, handouts and
              past questions — so the next person does not have to start from scratch.
            </p>

            <form className="hero__search" onSubmit={handleSearch} role="search">
              <span className="hero__search-icon">
                <SearchIcon size={21} />
              </span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by course code, subject or topic…"
                aria-label="Search notes"
              />
              <button type="submit" className="btn btn--primary">
                Search
              </button>
            </form>

            <div className="hero__quick">
              <span>Try:</span>
              <button type="button" onClick={() => updateParams({ q: 'CSC 301' })}>
                CSC 301
              </button>
              <button type="button" onClick={() => updateParams({ noteType: 'past_question' })}>
                Past questions
              </button>
              <button type="button" onClick={() => updateParams({ level: '100', q: undefined })}>
                100 level
              </button>
              {user?.departmentId ? (
                <button
                  type="button"
                  onClick={() => updateParams({ departmentId: String(user.departmentId), schoolId: undefined })}
                >
                  My department
                </button>
              ) : null}
            </div>

            <div className="hero__stats">
              <div>
                <strong>{formatNumber(stats?.notes ?? 0)}</strong>
                <span>notes shared</span>
              </div>
              <div>
                <strong>{formatNumber(stats?.students ?? 0)}</strong>
                <span>students</span>
              </div>
              <div>
                <strong>{formatNumber(stats?.departments ?? 0)}</strong>
                <span>departments</span>
              </div>
              <div>
                <strong>{formatNumber(stats?.downloads ?? 0)}</strong>
                <span>downloads</span>
              </div>
            </div>
          </div>

          <aside className="hero__aside" aria-label="Why OpenNote">
            <div className="hero-card">
              <span className="hero-card__icon">
                <BookIcon size={22} />
              </span>
              <h2>Study from what works</h2>
              <p>Real notes from students who already sat the course. Every post shows who shared it and when.</p>
              <ul>
                <li>
                  <NoteIcon size={17} /> Filter by school, department, level and course
                </li>
                <li>
                  <UsersIcon size={17} /> See the publisher and their class
                </li>
                <li>
                  <DownloadIcon size={17} /> Save pages to read offline
                </li>
              </ul>
            </div>
            <Link to="/notes/new" className="hero-card hero-card--cta">
              <span className="hero-card__icon">
                <UploadIcon size={22} />
              </span>
              <strong>Have a note that helped you?</strong>
              <span>Post it in under a minute →</span>
            </Link>
          </aside>
        </div>
      </section>

      <section className="container browse" id="browse">
        <div className="browse__main">
          <div className="section-heading">
            <div>
              <span className="eyebrow">The library</span>
              <h2>Browse notes</h2>
              <p>{activeLabel}</p>
            </div>
            <Link to="/notes/new" className="btn btn--primary btn--sm">
              <UploadIcon size={17} /> Post a note
            </Link>
          </div>

          <NoteFilters
            taxonomy={taxonomy}
            values={filters}
            total={notes?.meta.total}
            onChange={(patch) => updateParams(patch)}
            onReset={() =>
              updateParams({
                schoolId: undefined,
                departmentId: undefined,
                level: undefined,
                noteType: undefined,
                publisherId: undefined,
              })
            }
          />

          {error ? (
            <ErrorNotice message={error} onRetry={() => setReloadKey((key) => key + 1)} />
          ) : loading ? (
            <div className="note-grid" aria-busy="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <div className="note-card note-card--skeleton" key={index}>
                  <div className="skeleton skeleton--media" />
                  <div className="skeleton-body">
                    <div className="skeleton skeleton--line" />
                    <div className="skeleton skeleton--line skeleton--short" />
                    <div className="skeleton skeleton--line skeleton--tiny" />
                  </div>
                </div>
              ))}
            </div>
          ) : notes && notes.items.length > 0 ? (
            <>
              <div className="note-grid">
                {notes.items.map((note) => (
                  <NoteCard key={note.id} note={note} />
                ))}
              </div>
              <Pagination
                page={notes.meta.page}
                totalPages={notes.meta.totalPages}
                onChange={(next) => updateParams({ page: next === 1 ? undefined : String(next) }, false)}
              />
            </>
          ) : (
            <EmptyState
              icon={<SearchIcon size={30} />}
              title="No notes match that search yet"
              text="Try a broader filter — or be the first to share a note for this course."
              action={
                <Link to="/notes/new" className="btn btn--primary btn--sm">
                  <UploadIcon size={16} /> Post the first note
                </Link>
              }
            />
          )}
        </div>

        <aside className="browse__aside">
          <div className="aside-heading">
            <div>
              <span className="eyebrow">From the admins</span>
              <h3>Campus updates</h3>
            </div>
            <Link to="/announcements" className="text-link">
              View all
            </Link>
          </div>

          {announcements.length > 0 ? (
            <div className="announcement-stack">
              {announcements.map((announcement) => (
                <AnnouncementCard key={announcement.id} announcement={announcement} compact />
              ))}
            </div>
          ) : (
            <p className="muted">No updates posted yet.</p>
          )}

          <div className="aside-cta">
            <span className="aside-cta__icon">
              <MegaphoneIcon size={20} />
            </span>
            <h4>Got an update for campus?</h4>
            <p>Admins can post school notices, educational opportunities and verified business offers.</p>
            <Link to={user?.role === 'admin' || user?.role === 'superadmin' ? '/admin?tab=announcements' : '/login'} className="text-link">
              Admin console →
            </Link>
          </div>
        </aside>
      </section>

      <section className="container">
        <div className="share-banner">
          <div>
            <span className="eyebrow eyebrow--light">Pass it on</span>
            <h2>Your notes got you here. Help someone else get there.</h2>
            <p>Upload photos of your notes, tag the course and level, and it is live for every student on campus.</p>
          </div>
          <div className="share-banner__actions">
            <Link to="/notes/new" className="btn btn--light">
              <UploadIcon size={18} /> Share a note
            </Link>
            {!user ? (
              <Link to="/register" className="btn btn--outline-light">
                Create an account
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
