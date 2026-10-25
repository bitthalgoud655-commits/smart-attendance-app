import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getStudentSession, submitStudentAttendance } from '../../services/apiService';
import './StudentScan.css';

const StudentScan = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [session, setSession] = useState(null);
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let current = true;
    if (!token) {
      setMessage({ type: 'error', text: 'This QR code does not contain a valid attendance session.' });
      setLoading(false);
      return undefined;
    }
    getStudentSession(token)
      .then((activeSession) => {
        if (current) setSession(activeSession);
      })
      .catch((error) => {
        if (current) setMessage({ type: 'error', text: error.message });
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await submitStudentAttendance(token, { fullName, studentId });
      setSubmitted(true);
      setMessage({ type: 'success', text: result.message });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="student-scan-page">
      <section className="student-scan-card">
        <div className="student-scan-icon">✓</div>
        <p className="student-scan-kicker">Smart Attendance</p>
        <h1>Session attendance</h1>
        {loading && <p role="status">Checking this attendance session...</p>}
        {session && (
          <>
            <p className="student-scan-date">
              {session.className} · {session.subject} · {new Date(`${session.date}T00:00:00`).toLocaleDateString()}
            </p>
            <p className="student-scan-expires">
              Session QR expires {new Date(session.expiresAt).toLocaleTimeString()}.
            </p>
            <form className="student-attendance-form" onSubmit={handleSubmit}>
              <label htmlFor="student-full-name">Full name (as registered)</label>
              <input
                id="student-full-name"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                disabled={submitting || submitted}
              />
              <label htmlFor="student-id">College roll number or student ID</label>
              <input
                id="student-id"
                autoComplete="off"
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                required
                disabled={submitting || submitted}
              />
              <button type="submit" disabled={submitting || submitted}>
                {submitting ? 'Submitting...' : submitted ? 'Attendance submitted' : 'Submit attendance'}
              </button>
            </form>
          </>
        )}
        {message && <p className={`student-scan-message ${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}
        {!session && !loading && !message && <p role="alert">This attendance session is unavailable.</p>}
      </section>
    </main>
  );
};

export default StudentScan;
