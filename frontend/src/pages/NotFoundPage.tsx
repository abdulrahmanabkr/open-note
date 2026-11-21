import { Link } from 'react-router-dom';
import { ArrowLeftIcon, SearchIcon } from '../components/Icons';

export function NotFoundPage() {
  return (
    <section className="container page-section">
      <div className="forbidden">
        <span className="eyebrow">404</span>
        <h1>This page is not in the library.</h1>
        <p>The link may be old, or the note may have been removed by its publisher.</p>
        <div className="forbidden__actions">
          <Link to="/" className="btn btn--primary">
            <SearchIcon size={17} /> Browse notes
          </Link>
          <Link to="/dashboard" className="btn btn--ghost">
            <ArrowLeftIcon size={17} /> My dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}
