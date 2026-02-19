import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import './Navbar.css';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { settings } = useApp();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          <span className="navbar-icon">📋</span>
          <span className="navbar-title">{settings.schoolName}</span>
        </Link>

        <button
          className="navbar-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation"
        >
          <span className={`hamburger ${menuOpen ? 'open' : ''}`}></span>
        </button>

        <ul className={`navbar-links ${menuOpen ? 'active' : ''}`}>
          <li>
            <Link
              to="/"
              className={isActive('/') ? 'active' : ''}
              onClick={() => setMenuOpen(false)}
            >
              🏠 Home
            </Link>
          </li>
          <li>
            <Link
              to="/reports"
              className={isActive('/reports') ? 'active' : ''}
              onClick={() => setMenuOpen(false)}
            >
              📊 Reports
            </Link>
          </li>
          <li>
            <Link
              to="/settings"
              className={isActive('/settings') ? 'active' : ''}
              onClick={() => setMenuOpen(false)}
            >
              ⚙️ Settings
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
