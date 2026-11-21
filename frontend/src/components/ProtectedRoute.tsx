import { Navigate, Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../api/types';
import { ShieldIcon } from './Icons';

export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="page-loader" role="status">
      <span className="spinner" />
      <span>{label}…</span>
    </div>
  );
}

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader label="Checking your session" />;

  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <section className="container page-section">
        <div className="panel panel--narrow forbidden">
          <span className="forbidden__icon">
            <ShieldIcon size={34} />
          </span>
          <h1>Admins only</h1>
          <p>This area is reserved for OpenNote administrators. If you believe you should have access, contact student affairs.</p>
          <Link to="/" className="btn btn--primary">
            Back to notes
          </Link>
        </div>
      </section>
    );
  }

  return <Outlet />;
}
