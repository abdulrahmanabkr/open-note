import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Announcement, Paginated, Taxonomy } from '../api/types';
import { AnnouncementCard } from '../components/AnnouncementCard';
import { EmptyState } from '../components/EmptyState';
import { ErrorNotice } from '../components/ErrorNotice';
import { MegaphoneIcon, SearchIcon, ShieldIcon } from '../components/Icons';
import { Pagination } from '../components/Pagination';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 9;

export function AnnouncementsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin } = useAuth();
  const category = searchParams.get('category') ?? '';
  const q = searchParams.get('q') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  const [query, setQuery] = useState(q);
  const [data, setData] = useState<Paginated<Announcement> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api.get<Taxonomy>('/taxonomy').then(setTaxonomy).catch(() => undefined);
  }, []);

  useEffect(() => setQuery(q), [q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<Paginated<Announcement>>('/announcements', { category, q, page, limit: PAGE_SIZE })
      .then((result) => {
        if (!cancelled) setData(result);
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
  }, [category, q, page, reloadKey]);

  const categories = useMemo(
    () => [{ value: '', label: 'All updates' }, ...(taxonomy?.announcementCategories ?? [])],
    [taxonomy],
  );

  const updateParams = (patch: Record<string, string | undefined>) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(patch)) {
          if (!value) next.delete(key);
          else next.set(key, value);
        }
        if (!('page' in patch)) next.delete('page');
        return next;
      },
      { replace: true },
    );
  };

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    updateParams({ q: query.trim() || undefined });
  };

  return (
    <section className="container page-section">
      <div className="page-head page-head--split">
        <div>
          <span className="eyebrow">Noticeboard</span>
          <h1>Campus announcements</h1>
          <p>Official school updates, educational opportunities and verified offers — posted by OpenNote admins.</p>
        </div>
        {isAdmin ? (
          <Link to="/admin?tab=announcements" className="btn btn--primary">
            <ShieldIcon size={17} /> Post an update
          </Link>
        ) : null}
      </div>

      <div className="announcement-toolbar">
        <div className="tabs tabs--inline">
          {categories.map((item) => (
            <button
              key={item.value}
              type="button"
              className={category === item.value ? 'is-active' : ''}
              onClick={() => updateParams({ category: item.value || undefined })}
            >
              {item.label}
            </button>
          ))}
        </div>
        <form className="inline-search" onSubmit={handleSearch} role="search">
          <SearchIcon size={18} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search updates…"
            aria-label="Search announcements"
          />
          <button type="submit" className="btn btn--soft btn--sm">
            Search
          </button>
        </form>
      </div>

      {error ? (
        <ErrorNotice message={error} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : loading ? (
        <div className="announcement-grid" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="announcement announcement--skeleton" key={index}>
              <div className="skeleton skeleton--line skeleton--short" />
              <div className="skeleton skeleton--line" />
              <div className="skeleton skeleton--line" />
              <div className="skeleton skeleton--line skeleton--tiny" />
            </div>
          ))}
        </div>
      ) : data && data.items.length > 0 ? (
        <>
          <div className="announcement-grid">
            {data.items.map((announcement) => (
              <AnnouncementCard key={announcement.id} announcement={announcement} />
            ))}
          </div>
          <Pagination
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            onChange={(next) => updateParams({ page: next === 1 ? undefined : String(next) })}
          />
        </>
      ) : (
        <EmptyState
          icon={<MegaphoneIcon size={30} />}
          title="No updates here yet"
          text="Try another category or search term. New updates are posted by the admin team every week."
        />
      )}
    </section>
  );
}
