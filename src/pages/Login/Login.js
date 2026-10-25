import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { getTeacherRegistrationStatus } from '../../services/apiService';
import './Login.css';

const Login = () => {
  const { login, registerTeacher, teacher, authLoading, dataError } = useApp();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [teacherRegistered, setTeacherRegistered] = useState(null);
  const [registrationError, setRegistrationError] = useState('');
  const [mode, setMode] = useState('register');

  useEffect(() => {
    let mounted = true;
    getTeacherRegistrationStatus()
      .then(({ teacherRegistered: registered }) => {
        if (!mounted) return;
        setTeacherRegistered(registered);
        setMode(registered ? 'login' : 'register');
      })
      .catch((error) => {
        if (mounted) setRegistrationError(error.message);
      });
    return () => { mounted = false; };
  }, []);

  if (authLoading || teacherRegistered === null) {
    return <main className="login-page"><p>{registrationError || 'Checking teacher account...'}</p></main>;
  }
  if (teacher) return <Navigate to="/" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (mode === 'register' && password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      if (mode === 'register') await registerTeacher({ username, password });
      else await login({ username, password });
      navigate('/', { replace: true });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <p className="login-kicker">Smart Attendance</p>
        <h1>{mode === 'register' ? 'Create teacher account' : 'Teacher sign in'}</h1>
        <p>
          {mode === 'register'
            ? 'Create the first teacher account. Registration closes after this account is created.'
            : 'Sign in to create attendance sessions and view reports.'}
        </p>
        <label htmlFor="teacher-username">Username</label>
        <input
          id="teacher-username"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          minLength={3}
          maxLength={40}
          pattern="[A-Za-z0-9._-]+"
          required
        />
        <label htmlFor="teacher-password">Password</label>
        <input
          id="teacher-password"
          type="password"
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={mode === 'register' ? 12 : undefined}
          maxLength={128}
          required
        />
        {mode === 'register' && (
          <>
            <label htmlFor="teacher-confirm-password">Confirm password</label>
            <input
              id="teacher-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={12}
              maxLength={128}
              required
            />
            <p className="login-hint">Use at least 12 characters. Only one teacher account can be registered.</p>
          </>
        )}
        {(message || dataError || registrationError) && (
          <p className="login-error" role="alert">{message || dataError || registrationError}</p>
        )}
        <button type="submit" disabled={submitting}>
          {submitting
            ? (mode === 'register' ? 'Creating account...' : 'Signing in...')
            : (mode === 'register' ? 'Create account' : 'Sign in')}
        </button>
        {(!teacherRegistered || mode === 'register') && (
          <button
            className="login-mode-toggle"
            type="button"
            disabled={submitting}
            onClick={() => {
              setMode(mode === 'register' ? 'login' : 'register');
              setMessage('');
            }}
          >
            {mode === 'register' ? 'Already registered? Sign in' : 'First time here? Create account'}
          </button>
        )}
      </form>
    </main>
  );
};

export default Login;
