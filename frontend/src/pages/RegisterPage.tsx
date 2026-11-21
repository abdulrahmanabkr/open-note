import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import type { Taxonomy } from '../api/types';
import { CheckIcon, SearchIcon, UploadIcon, UsersIcon } from '../components/Icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { levelLabel, safeNextPath } from '../lib/format';

interface FieldErrors {
  [key: string]: string | undefined;
}

export function RegisterPage() {
  const { register, user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));

  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    schoolId: '',
    departmentId: '',
    level: '',
    matricNo: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<Taxonomy>('/taxonomy').then(setTaxonomy).catch(() => undefined);
  }, []);

  if (user) {
    return <Navigate to={next} replace />;
  }

  const school = taxonomy?.schools.find((item) => String(item.id) === form.schoolId);
  const departments = school ? school.departments : (taxonomy?.schools ?? []).flatMap((item) => item.departments);

  const set = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (form.fullName.trim().length < 2) nextErrors.fullName = 'Enter your full name.';
    if (!form.email.includes('@')) nextErrors.email = 'Enter a valid email address.';
    if (form.password.length < 8) nextErrors.password = 'Use at least 8 characters.';
    if (form.password !== form.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.';
    if (!form.schoolId) nextErrors.schoolId = 'Select your school or faculty.';
    if (!form.departmentId) nextErrors.departmentId = 'Select your department.';
    if (!form.level) nextErrors.level = 'Select your level.';

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await register({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        schoolId: Number(form.schoolId),
        departmentId: Number(form.departmentId),
        level: form.level,
        matricNo: form.matricNo.trim() || null,
      });
      notify('Your OpenNote account is ready. Welcome!');
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.details) setErrors(err.details);
      } else {
        setError('Could not create your account. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth auth--register">
      <aside className="auth__side">
        <div>
          <Link to="/" className="brand brand--light">
            <span className="brand__mark">
              <svg viewBox="0 0 40 40" width="34" height="34">
                <rect width="40" height="40" rx="11" fill="currentColor" />
                <path d="M12 9h11l6 6v16H12z" fill="#ffffff" />
                <path d="M23 9v7h6" fill="var(--logo-fold, #f59e0b)" />
                <path d="M17 20h7M17 25h7" stroke="#2e1065" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </span>
            <span className="brand__text">
              Open<span>Note</span>
            </span>
          </Link>
          <span className="eyebrow eyebrow--light">Join the library</span>
          <h1>Notes are better when they are shared.</h1>
          <p>
            Create a free account to save notes, download pages and publish your own. Every note is signed with your
            name, class and department.
          </p>
          <ul className="auth__list">
            <li>
              <SearchIcon size={18} /> Everything is free to browse
            </li>
            <li>
              <UsersIcon size={18} /> Credit stays with the student who shared it
            </li>
            <li>
              <UploadIcon size={18} /> Post multiple pages at a time
            </li>
          </ul>
        </div>
        <div className="auth__quote-card">
          <span className="eyebrow eyebrow--light">Campus rule</span>
          <p>Only post notes you are comfortable sharing with your whole department. Cite the lecturer or source.</p>
          <span className="auth__quote-badge">
            <CheckIcon size={15} /> Keep it useful, keep it kind
          </span>
        </div>
      </aside>

      <section className="auth__panel">
        <div className="auth__form auth__form--wide">
          <span className="eyebrow">Create your account</span>
          <h2>Join OpenNote</h2>
          <p className="muted">Takes less than a minute. Your details appear on notes you publish.</p>

          {error ? (
            <div className="notice notice--error" role="alert">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="form" noValidate>
            <div className="form-grid">
              <label className={`field ${errors.fullName ? 'field--error' : ''}`}>
                <span className="field__label">Full name</span>
                <input
                  value={form.fullName}
                  onChange={(event) => set('fullName', event.target.value)}
                  placeholder="Zara Ibrahim"
                  autoComplete="name"
                />
                {errors.fullName ? <span className="field__error">{errors.fullName}</span> : null}
              </label>

              <label className={`field ${errors.email ? 'field--error' : ''}`}>
                <span className="field__label">Email address</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => set('email', event.target.value)}
                  placeholder="you@university.edu"
                  autoComplete="email"
                />
                {errors.email ? <span className="field__error">{errors.email}</span> : null}
              </label>

              <label className={`field ${errors.password ? 'field--error' : ''}`}>
                <span className="field__label">Password</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => set('password', event.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
                {errors.password ? <span className="field__error">{errors.password}</span> : null}
              </label>

              <label className={`field ${errors.confirmPassword ? 'field--error' : ''}`}>
                <span className="field__label">Confirm password</span>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(event) => set('confirmPassword', event.target.value)}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                />
                {errors.confirmPassword ? <span className="field__error">{errors.confirmPassword}</span> : null}
              </label>

              <label className={`field ${errors.schoolId ? 'field--error' : ''}`}>
                <span className="field__label">School / faculty</span>
                <select
                  value={form.schoolId}
                  onChange={(event) => {
                    set('schoolId', event.target.value);
                    set('departmentId', '');
                  }}
                >
                  <option value="">Select your school</option>
                  {taxonomy?.schools.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {errors.schoolId ? <span className="field__error">{errors.schoolId}</span> : null}
              </label>

              <label className={`field ${errors.departmentId ? 'field--error' : ''}`}>
                <span className="field__label">Department</span>
                <select value={form.departmentId} onChange={(event) => set('departmentId', event.target.value)}>
                  <option value="">Select your department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
                {errors.departmentId ? <span className="field__error">{errors.departmentId}</span> : null}
              </label>

              <label className={`field ${errors.level ? 'field--error' : ''}`}>
                <span className="field__label">Level</span>
                <select value={form.level} onChange={(event) => set('level', event.target.value)}>
                  <option value="">Select your level</option>
                  {taxonomy?.levels.map((level) => (
                    <option key={level} value={level}>
                      {levelLabel(level)}
                    </option>
                  ))}
                </select>
                {errors.level ? <span className="field__error">{errors.level}</span> : null}
              </label>

              <label className="field">
                <span className="field__label">Matric / student ID (optional)</span>
                <input
                  value={form.matricNo}
                  onChange={(event) => set('matricNo', event.target.value)}
                  placeholder="CSC/22/1043"
                />
              </label>
            </div>

            <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
              {submitting ? 'Creating account…' : 'Create account'}
            </button>
            <p className="form__fineprint">
              By joining you agree to share notes responsibly and to credit the original author or lecturer where
              appropriate.
            </p>
          </form>

          <p className="auth__switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
