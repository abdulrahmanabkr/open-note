import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './Avatar';
import {
  BookIcon,
  ChevronDownIcon,
  LogoutIcon,
  MegaphoneIcon,
  MenuIcon,
  NoteIcon,
  PlusIcon,
  ShieldIcon,
  UploadIcon,
  UsersIcon,
} from './Icons';

function Brand() {
  return (
    <Link to="/" className="brand" aria-label="OpenNote home">
      <span className="brand__mark" aria-hidden="true">
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
  );
}

export function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!accountOpen) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [accountOpen]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container site-header__inner">
          <Brand />

          <nav className={`site-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
            <NavLink to="/" end className="site-nav__link">
              <BookIcon size={18} /> Browse notes
            </NavLink>
            <NavLink to="/announcements" className="site-nav__link">
              <MegaphoneIcon size={18} /> Announcements
            </NavLink>
            {user ? (
              <NavLink to="/dashboard" className="site-nav__link">
                <NoteIcon size={18} /> My dashboard
              </NavLink>
            ) : null}
            {isAdmin ? (
              <NavLink to="/admin" className="site-nav__link">
                <ShieldIcon size={18} /> Admin
              </NavLink>
            ) : null}
          </nav>

          <div className="site-header__actions">
            {user ? (
              <>
                <Link to="/notes/new" className="btn btn--primary btn--sm site-header__post">
                  <UploadIcon size={17} /> Post a note
                </Link>
                <div className="account" ref={menuRef}>
                  <button
                    type="button"
                    className="account__trigger"
                    onClick={() => setAccountOpen((open) => !open)}
                    aria-expanded={accountOpen}
                    aria-haspopup="menu"
                  >
                    <Avatar name={user.fullName} size="sm" />
                    <span className="account__name">{user.fullName.split(' ')[0]}</span>
                    <ChevronDownIcon size={16} />
                  </button>
                  {accountOpen ? (
                    <div className="account__menu" role="menu">
                      <div className="account__header">
                        <strong>{user.fullName}</strong>
                        <span>{user.email}</span>
                        <span className={`role-pill role-pill--${user.role}`}>{user.role}</span>
                      </div>
                      <Link to="/dashboard" role="menuitem">
                        <NoteIcon size={17} /> My notes
                      </Link>
                      <Link to="/profile" role="menuitem">
                        <UsersIcon size={17} /> Profile
                      </Link>
                      {isAdmin ? (
                        <Link to="/admin" role="menuitem">
                          <ShieldIcon size={17} /> Admin console
                        </Link>
                      ) : null}
                      <Link to="/notes/new" role="menuitem">
                        <PlusIcon size={17} /> Post a note
                      </Link>
                      <button type="button" role="menuitem" onClick={handleLogout}>
                        <LogoutIcon size={17} /> Sign out
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="site-header__guest">
                <Link to="/login" className="btn btn--ghost btn--sm">
                  Log in
                </Link>
                <Link to="/register" className="btn btn--primary btn--sm">
                  Join<span className="site-header__join-suffix"> OpenNote</span>
                </Link>
              </div>
            )}

            <button
              type="button"
              className="mobile-toggle"
              aria-label="Toggle navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MenuIcon size={22} />
            </button>
          </div>
        </div>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container site-footer__inner">
          <div className="site-footer__brand">
            <Brand />
            <p>Notes shared by students, for students. Free to browse, easy to contribute.</p>
          </div>
          <div className="site-footer__links">
            <div>
              <h4>Study</h4>
              <Link to="/">Browse notes</Link>
              <Link to="/notes/new">Share a note</Link>
              <Link to="/announcements">Campus updates</Link>
            </div>
            <div>
              <h4>Account</h4>
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/profile">Profile</Link>
              <Link to="/register">Create an account</Link>
            </div>
          </div>
        </div>
        <div className="container site-footer__base">
          <span>© {new Date().getFullYear()} OpenNote. Built for the campus community.</span>
          <span>Be kind. Cite your sources. Share what helped you.</span>
        </div>
      </footer>
    </div>
  );
}
