import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { BookIcon, CheckIcon, SearchIcon, UploadIcon } from '../components/Icons';
import { safeNextPath } from '../lib/format';

const DEMO_ACCOUNTS = [
  { label: 'Student demo', email: 'zara@opennote.app', password: 'Student1234!' },
  { label: 'Admin demo', email: 'admin@opennote.app', password: 'Admin1234!' },
];

export function LoginPage() {
  const { login, user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to={next} replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      notify('Welcome back to OpenNote.');
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign you in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
  };

  return (
    <div className="auth">
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
          <span className="eyebrow eyebrow--light">One campus library</span>
          <h1>Pick up where the last student left off.</h1>
          <p>
            Sign in to save notes, track the ones you shared, and pick up study material from every department in the
            university.
          </p>
          <ul className="auth__list">
            <li>
              <SearchIcon size={18} /> Search by course code, department or level
            </li>
            <li>
              <BookIcon size={18} /> Read notes page by page, right in the browser
            </li>
            <li>
              <UploadIcon size={18} /> Share your own notes in minutes
            </li>
          </ul>
        </div>
        <blockquote>
          “The notes are already out there. OpenNote just makes sure the next person can find them.”
          <cite>— Zara, 300L Computer Science</cite>
        </blockquote>
      </aside>

      <section className="auth__panel">
        <div className="auth__form">
          <span className="eyebrow">Welcome back</span>
          <h2>Log in to OpenNote</h2>
          <p className="muted">Use the email you registered with.</p>

          {error ? (
            <div className="notice notice--error" role="alert">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="form">
            <label className="field">
              <span className="field__label">Email address</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@university.edu"
                autoComplete="email"
                required
              />
            </label>

            <label className="field">
              <span className="field__label">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
                required
              />
            </label>

            <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Log in'}
            </button>
          </form>

          <div className="demo-box">
            <span className="demo-box__label">Try a seeded account</span>
            <div className="demo-box__buttons">
              {DEMO_ACCOUNTS.map((account) => (
                <button key={account.email} type="button" onClick={() => fillDemo(account)}>
                  <CheckIcon size={14} /> {account.label}
                </button>
              ))}
            </div>
            <p>Student: zara@opennote.app · Admin: admin@opennote.app</p>
          </div>

          <p className="auth__switch">
            New here? <Link to={`/register${next !== '/dashboard' ? `?next=${encodeURIComponent(next)}` : ''}`}>Create an account</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
