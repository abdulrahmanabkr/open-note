import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import type { Taxonomy, User } from '../api/types';
import { Avatar } from '../components/Avatar';
import { ErrorNotice } from '../components/ErrorNotice';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDate, levelLabel } from '../lib/format';

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const { notify } = useToast();
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [form, setForm] = useState({
    fullName: user?.fullName ?? '',
    schoolId: user?.schoolId ? String(user.schoolId) : '',
    departmentId: user?.departmentId ? String(user.departmentId) : '',
    level: user?.level ?? '',
    matricNo: user?.matricNo ?? '',
    bio: user?.bio ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Taxonomy>('/taxonomy').then(setTaxonomy).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user) return;
    setForm({
      fullName: user.fullName,
      schoolId: user.schoolId ? String(user.schoolId) : '',
      departmentId: user.departmentId ? String(user.departmentId) : '',
      level: user.level ?? '',
      matricNo: user.matricNo ?? '',
      bio: user.bio ?? '',
    });
  }, [user]);

  if (!user) return null;

  const school = taxonomy?.schools.find((item) => String(item.id) === form.schoolId);
  const departments = school ? school.departments : (taxonomy?.schools ?? []).flatMap((item) => item.departments);

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const data = await api.patch<{ user: User }>('/auth/me', {
        fullName: form.fullName.trim(),
        schoolId: form.schoolId ? Number(form.schoolId) : null,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
        level: form.level || null,
        matricNo: form.matricNo.trim() || null,
        bio: form.bio.trim() || null,
      });
      setUser(data.user);
      notify('Profile updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="container page-section">
      <div className="page-head">
        <div>
          <span className="eyebrow">Account</span>
          <h1>Your profile</h1>
          <p>These details are attached to every note you publish, so keep them accurate.</p>
        </div>
      </div>

      <div className="profile-layout">
        <aside className="profile-card">
          <Avatar name={user.fullName} size="lg" />
          <h2>{user.fullName}</h2>
          <p>{user.email}</p>
          <span className={`role-pill role-pill--${user.role}`}>{user.role}</span>
          <dl>
            <div>
              <dt>School</dt>
              <dd>{user.schoolName ?? 'Not set'}</dd>
            </div>
            <div>
              <dt>Department</dt>
              <dd>{user.departmentName ?? 'Not set'}</dd>
            </div>
            <div>
              <dt>Level</dt>
              <dd>{levelLabel(user.level) || 'Not set'}</dd>
            </div>
            <div>
              <dt>Matric no.</dt>
              <dd>{user.matricNo ?? 'Not set'}</dd>
            </div>
            <div>
              <dt>Joined</dt>
              <dd>{formatDate(user.createdAt)}</dd>
            </div>
          </dl>
          <Link to="/dashboard" className="btn btn--soft btn--sm btn--block">
            Go to dashboard
          </Link>
        </aside>

        <div className="panel">
          <div className="panel__head">
            <span className="step">✎</span>
            <div>
              <h2>Edit details</h2>
              <p>Changing your department does not move notes you already published.</p>
            </div>
          </div>

          {error ? <ErrorNotice message={error} /> : null}

          <form className="form" onSubmit={handleSubmit}>
            <label className="field">
              <span className="field__label">Full name</span>
              <input value={form.fullName} onChange={(event) => set('fullName', event.target.value)} required />
            </label>

            <div className="form-grid">
              <label className="field">
                <span className="field__label">School / faculty</span>
                <select
                  value={form.schoolId}
                  onChange={(event) => {
                    set('schoolId', event.target.value);
                    set('departmentId', '');
                  }}
                >
                  <option value="">Select a school</option>
                  {taxonomy?.schools.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field__label">Department</span>
                <select value={form.departmentId} onChange={(event) => set('departmentId', event.target.value)}>
                  <option value="">Select a department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field__label">Level</span>
                <select value={form.level} onChange={(event) => set('level', event.target.value)}>
                  <option value="">Select a level</option>
                  {taxonomy?.levels.map((level) => (
                    <option key={level} value={level}>
                      {levelLabel(level)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field__label">Matric / student ID</span>
                <input value={form.matricNo} onChange={(event) => set('matricNo', event.target.value)} />
              </label>
            </div>

            <label className="field">
              <span className="field__label">Short bio (optional)</span>
              <textarea
                value={form.bio}
                onChange={(event) => set('bio', event.target.value)}
                rows={3}
                maxLength={280}
                placeholder="What do you study? What kind of notes do you share?"
              />
              <span className="field__hint">{form.bio.length}/280</span>
            </label>

            <div className="post-actions">
              <Link to="/dashboard" className="btn btn--ghost">
                Cancel
              </Link>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
