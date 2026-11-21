import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import type { AdminStats, Announcement, Paginated, Role, User } from '../api/types';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { ErrorNotice } from '../components/ErrorNotice';
import {
  BookIcon,
  DownloadIcon,
  EditIcon,
  EyeIcon,
  MegaphoneIcon,
  PinIcon,
  PlusIcon,
  ShieldIcon,
  TrashIcon,
  UsersIcon,
} from '../components/Icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDate, formatNumber, formatRelative, levelLabel } from '../lib/format';

type Tab = 'overview' | 'announcements' | 'users';

const CATEGORIES = [
  { value: 'school', label: 'School update' },
  { value: 'educational', label: 'Educational' },
  { value: 'business', label: 'Business' },
];

const EMPTY_FORM = { title: '', body: '', category: 'school', isPinned: false };

export function AdminPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: Tab = tabParam === 'announcements' || tabParam === 'users' ? tabParam : 'overview';
  const isSuperAdmin = user?.role === 'superadmin';

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);
  const [users, setUsers] = useState<Paginated<User> | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [form, setForm] = useState<typeof EMPTY_FORM & { id: number | null }>({ ...EMPTY_FORM, id: null });
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [announcementFormError, setAnnouncementFormError] = useState<string | null>(null);

  const [userQuery, setUserQuery] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userPage, setUserPage] = useState(1);

  const refresh = () => setReloadKey((key) => key + 1);

  useEffect(() => {
    if (tab !== 'overview') return;
    let cancelled = false;
    setLoading(true);
    setStatsError(null);
    api
      .get<AdminStats>('/admin/stats')
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setStatsError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, reloadKey]);

  useEffect(() => {
    if (tab !== 'announcements') return;
    let cancelled = false;
    setLoading(true);
    setAnnouncementsError(null);
    api
      .get<Paginated<Announcement>>('/announcements', { limit: 50 })
      .then((data) => {
        if (!cancelled) setAnnouncements(data.items);
      })
      .catch((err: Error) => {
        if (!cancelled) setAnnouncementsError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, reloadKey]);

  useEffect(() => {
    if (tab !== 'users') return;
    let cancelled = false;
    setUsersLoading(true);
    setUsersError(null);
    api
      .get<Paginated<User>>('/admin/users', { q: userQuery, role: userRole, page: userPage, limit: 20 })
      .then((data) => {
        if (!cancelled) setUsers(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setUsersError(err.message);
      })
      .finally(() => {
        if (!cancelled) setUsersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, userQuery, userRole, userPage, reloadKey]);

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'overview') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  const editAnnouncement = (announcement: Announcement) => {
    setForm({
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      category: announcement.category,
      isPinned: announcement.isPinned,
    });
    setAnnouncementFormError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setForm({ ...EMPTY_FORM, id: null });
    setAnnouncementFormError(null);
  };

  const submitAnnouncement = async (event: FormEvent) => {
    event.preventDefault();
    if (form.title.trim().length < 3 || form.body.trim().length < 10) {
      setAnnouncementFormError('Add a title and a body of at least 10 characters.');
      return;
    }

    setSavingAnnouncement(true);
    setAnnouncementFormError(null);
    try {
      if (form.id) {
        await api.patch(`/announcements/${form.id}`, {
          title: form.title.trim(),
          body: form.body.trim(),
          category: form.category,
          isPinned: form.isPinned,
        });
        notify('Update saved.');
      } else {
        await api.post('/announcements', {
          title: form.title.trim(),
          body: form.body.trim(),
          category: form.category,
          isPinned: form.isPinned,
        });
        notify('Update published to the noticeboard.');
      }
      resetForm();
      refresh();
    } catch (err) {
      setAnnouncementFormError(err instanceof ApiError ? err.message : 'Could not publish that update.');
    } finally {
      setSavingAnnouncement(false);
    }
  };

  const deleteAnnouncement = async (announcement: Announcement) => {
    if (!window.confirm(`Delete “${announcement.title}”?`)) return;
    try {
      await api.delete(`/announcements/${announcement.id}`);
      notify('Update deleted.');
      if (form.id === announcement.id) resetForm();
      refresh();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not delete the update.', 'error');
    }
  };

  const changeRole = async (target: User, role: Role) => {
    try {
      await api.patch(`/admin/users/${target.id}/role`, { role });
      notify(`${target.fullName} is now ${role}.`);
      refresh();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not change that role.', 'error');
    }
  };

  const deleteUser = async (target: User) => {
    if (!window.confirm(`Delete ${target.fullName} and all of their notes? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${target.id}`);
      notify('User deleted.');
      refresh();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not delete that user.', 'error');
    }
  };

  return (
    <section className="container page-section">
      <div className="page-head page-head--split">
        <div>
          <span className="eyebrow">Admin console</span>
          <h1>Campus operations</h1>
          <p>Post official updates and keep the OpenNote community healthy.</p>
        </div>
        <span className="admin-badge">
          <ShieldIcon size={17} /> {isSuperAdmin ? 'Superadmin access' : 'Admin access'}
        </span>
      </div>

      <div className="tabs">
        <button type="button" className={tab === 'overview' ? 'is-active' : ''} onClick={() => setTab('overview')}>
          <EyeIcon size={17} /> Overview
        </button>
        <button
          type="button"
          className={tab === 'announcements' ? 'is-active' : ''}
          onClick={() => setTab('announcements')}
        >
          <MegaphoneIcon size={17} /> Announcements
        </button>
        <button type="button" className={tab === 'users' ? 'is-active' : ''} onClick={() => setTab('users')}>
          <UsersIcon size={17} /> Users
        </button>
      </div>

      {tab === 'overview' ? (
        statsError ? (
          <ErrorNotice message={statsError} onRetry={refresh} />
        ) : loading || !stats ? (
          <div className="page-loader" role="status">
            <span className="spinner" />
            <span>Loading stats…</span>
          </div>
        ) : (
          <>
            <div className="stat-grid">
              <div className="stat-card">
                <span>
                  <UsersIcon size={19} /> Students
                </span>
                <strong>{formatNumber(stats.stats.students)}</strong>
              </div>
              <div className="stat-card">
                <span>
                  <BookIcon size={19} /> Notes
                </span>
                <strong>{formatNumber(stats.stats.notes)}</strong>
              </div>
              <div className="stat-card">
                <span>
                  <MegaphoneIcon size={19} /> Announcements
                </span>
                <strong>{formatNumber(stats.stats.announcements)}</strong>
              </div>
              <div className="stat-card">
                <span>
                  <DownloadIcon size={19} /> Downloads
                </span>
                <strong>{formatNumber(stats.stats.downloads)}</strong>
              </div>
              <div className="stat-card">
                <span>
                  <EyeIcon size={19} /> Note views
                </span>
                <strong>{formatNumber(stats.stats.views)}</strong>
              </div>
              <div className="stat-card">
                <span>
                  <ShieldIcon size={19} /> Admins
                </span>
                <strong>{formatNumber(stats.stats.admins)}</strong>
              </div>
            </div>

            <div className="panel">
              <div className="panel__head">
                <span className="step">↗</span>
                <div>
                  <h2>Latest notes</h2>
                  <p>The five most recent uploads across the campus.</p>
                </div>
                <Link to="/" className="text-link panel__link">
                  Browse all
                </Link>
              </div>
              <div className="latest-list">
                {stats.latestNotes.length === 0 ? (
                  <p className="muted">No notes yet.</p>
                ) : (
                  stats.latestNotes.map((note) => (
                    <Link key={note.id} to={`/notes/${note.id}`} className="latest-item">
                      <div>
                        <strong>{note.title}</strong>
                        <span>
                          {note.publisherName} · {formatRelative(note.createdAt)}
                        </span>
                      </div>
                      <span className="text-link">Open →</span>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </>
        )
      ) : null}

      {tab === 'announcements' ? (
        <div className="admin-grid">
          <div className="panel">
            <div className="panel__head">
              <span className="step">{form.id ? '✎' : <PlusIcon size={18} />}</span>
              <div>
                <h2>{form.id ? 'Edit update' : 'New update'}</h2>
                <p>School notices, educational opportunities and verified business offers.</p>
              </div>
            </div>

            {announcementFormError ? <div className="notice notice--error">{announcementFormError}</div> : null}

            <form className="form" onSubmit={submitAnnouncement}>
              <label className="field">
                <span className="field__label">Title</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="e.g. Course registration closes Friday"
                  maxLength={200}
                />
              </label>

              <label className="field">
                <span className="field__label">Category</span>
                <select
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field__label">Message</span>
                <textarea
                  value={form.body}
                  onChange={(event) => setForm({ ...form, body: event.target.value })}
                  rows={7}
                  placeholder="Write the full update. Include dates, locations and any action students need to take."
                />
              </label>

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.isPinned}
                  onChange={(event) => setForm({ ...form, isPinned: event.target.checked })}
                />
                <span>
                  <PinIcon size={15} /> Pin to the top of the noticeboard
                </span>
              </label>

              <div className="post-actions">
                {form.id ? (
                  <button type="button" className="btn btn--ghost" onClick={resetForm}>
                    Cancel edit
                  </button>
                ) : null}
                <button type="submit" className="btn btn--primary" disabled={savingAnnouncement}>
                  {savingAnnouncement ? 'Saving…' : form.id ? 'Save update' : 'Publish update'}
                </button>
              </div>
            </form>
          </div>

          <div className="panel">
            <div className="panel__head">
              <span className="step">☰</span>
              <div>
                <h2>Published updates</h2>
                <p>{announcements.length} updates on the noticeboard.</p>
              </div>
            </div>

            {announcementsError ? (
              <ErrorNotice message={announcementsError} onRetry={refresh} />
            ) : loading ? (
              <div className="page-loader" role="status">
                <span className="spinner" />
                <span>Loading updates…</span>
              </div>
            ) : announcements.length === 0 ? (
              <EmptyState
                icon={<MegaphoneIcon size={28} />}
                title="No announcements yet"
                text="Publish the first update using the form."
                compact
              />
            ) : (
              <div className="admin-announcements">
                {announcements.map((announcement) => (
                  <article key={announcement.id} className="admin-announcement">
                    <div className="admin-announcement__top">
                      <span className={`category category--${announcement.category}`}>
                        {announcement.categoryLabel}
                      </span>
                      {announcement.isPinned ? (
                        <span className="announcement__pinned">
                          <PinIcon size={13} /> Pinned
                        </span>
                      ) : null}
                      <time>{formatDate(announcement.createdAt)}</time>
                    </div>
                    <h3>{announcement.title}</h3>
                    <p>{announcement.body}</p>
                    <div className="admin-announcement__actions">
                      <button type="button" className="btn btn--outline btn--sm" onClick={() => editAnnouncement(announcement)}>
                        <EditIcon size={15} /> Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger-ghost btn--sm"
                        onClick={() => void deleteAnnouncement(announcement)}
                      >
                        <TrashIcon size={15} /> Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'users' ? (
        <div className="panel">
          <div className="panel__head">
            <span className="step">
              <UsersIcon size={18} />
            </span>
            <div>
              <h2>People on OpenNote</h2>
              <p>
                {isSuperAdmin
                  ? 'Search the directory, promote admins or remove accounts.'
                  : 'Search the directory. Role changes require superadmin access.'}
              </p>
            </div>
          </div>

          <div className="user-toolbar">
            <form
              className="inline-search"
              onSubmit={(event) => {
                event.preventDefault();
                setUserPage(1);
                refresh();
              }}
            >
              <input
                value={userQuery}
                onChange={(event) => setUserQuery(event.target.value)}
                placeholder="Search name, email or matric no…"
                aria-label="Search users"
              />
              <button type="submit" className="btn btn--soft btn--sm">
                Search
              </button>
            </form>
            <select
              value={userRole}
              onChange={(event) => {
                setUserRole(event.target.value);
                setUserPage(1);
              }}
              aria-label="Filter by role"
            >
              <option value="">All roles</option>
              <option value="student">Students</option>
              <option value="admin">Admins</option>
              <option value="superadmin">Superadmins</option>
            </select>
          </div>

          {usersError ? (
            <ErrorNotice message={usersError} onRetry={refresh} />
          ) : usersLoading || !users ? (
            <div className="page-loader" role="status">
              <span className="spinner" />
              <span>Loading people…</span>
            </div>
          ) : users.items.length === 0 ? (
            <EmptyState title="No people match that search" text="Try a different name or email." compact />
          ) : (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Class</th>
                      <th>Joined</th>
                      <th>Role</th>
                      {isSuperAdmin ? <th aria-label="Actions" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {users.items.map((person) => (
                      <tr key={person.id}>
                        <td>
                          <div className="person-cell">
                            <Avatar name={person.fullName} size="sm" />
                            <div>
                              <strong>{person.fullName}</strong>
                              <span>{person.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong>{person.departmentName ?? '—'}</strong>
                          <span className="cell-sub">
                            {levelLabel(person.level) || 'Staff'}
                            {person.matricNo ? ` · ${person.matricNo}` : ''}
                          </span>
                        </td>
                        <td>{formatDate(person.createdAt)}</td>
                        <td>
                          {isSuperAdmin && person.id !== user?.id ? (
                            <select
                              value={person.role}
                              onChange={(event) => void changeRole(person, event.target.value as Role)}
                              aria-label={`Role for ${person.fullName}`}
                            >
                              <option value="student">Student</option>
                              <option value="admin">Admin</option>
                              <option value="superadmin">Superadmin</option>
                            </select>
                          ) : (
                            <span className={`role-pill role-pill--${person.role}`}>{person.role}</span>
                          )}
                        </td>
                        {isSuperAdmin ? (
                          <td>
                            {person.id !== user?.id ? (
                              <button
                                type="button"
                                className="icon-btn icon-btn--danger"
                                onClick={() => void deleteUser(person)}
                                aria-label={`Delete ${person.fullName}`}
                              >
                                <TrashIcon size={16} />
                              </button>
                            ) : (
                              <span className="muted">You</span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="user-pagination">
                <span>
                  Page {users.meta.page} of {users.meta.totalPages} · {users.meta.total} people
                </span>
                <div>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={!users.meta.hasPrev}
                    onClick={() => setUserPage((page) => Math.max(1, page - 1))}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={!users.meta.hasNext}
                    onClick={() => setUserPage((page) => page + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
