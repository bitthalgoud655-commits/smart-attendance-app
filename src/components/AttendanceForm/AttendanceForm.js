import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../../context/AppContext';
import './AttendanceForm.css';

const SessionQrCode = ({ url }) => {
  const [image, setImage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    setError('');
    QRCode.toDataURL(url, {
      width: 320,
      margin: 4,
      errorCorrectionLevel: 'L',
      color: { dark: '#000000', light: '#ffffff' },
    }).then((dataUrl) => {
      if (current) setImage(dataUrl);
    }).catch((qrError) => {
      if (current) setError(qrError.message || 'Could not generate the attendance QR.');
    });
    return () => { current = false; };
  }, [url]);

  if (error) return <p className="session-error">{error}</p>;
  return image ? <img src={image} alt="Session attendance QR code" /> : <p>Generating secure session QR...</p>;
};

const AttendanceForm = () => {
  const {
    selectedClass,
    setSelectedClass,
    getFilteredStudents,
    getTodayAttendance,
    attendanceSessions,
    students,
    settings,
    startSession,
    endSession,
  } = useApp();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [endingId, setEndingId] = useState('');
  const filteredStudents = getFilteredStudents();
  const todayAttendance = getTodayAttendance();
  const attendanceByStudent = Object.fromEntries(
    [...todayAttendance]
      .sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp))
      .map((record) => [record.studentId, record])
  );
  const classesWithStudents = settings.classOptions.filter((className) =>
    students.some((student) => student.class === className)
  );
  const activeSessions = attendanceSessions.filter((session) => session.status === 'active');

  const handleStartSession = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      await startSession({ className: selectedClass, subject });
      setSubject('');
      setMessage({ type: 'success', text: 'Session started. Students can now scan the displayed QR code.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndSession = async (sessionId) => {
    setEndingId(sessionId);
    setMessage(null);
    try {
      const result = await endSession(sessionId);
      setMessage({
        type: 'success',
        text: `Session ended. ${result.newlyAbsentCount} unscanned students marked absent; its QR code can no longer be used.`,
      });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setEndingId('');
    }
  };

  return (
    <section className="attendance-form-container">
      <div className="attendance-form-header">
        <div>
          <span className="scanner-kicker">Teacher portal</span>
          <h2>Attendance Sessions</h2>
        </div>
        <span>{filteredStudents.length} registered students</span>
      </div>

      <form className="session-start-form" onSubmit={handleStartSession}>
        <label>
          Class
          <select
            value={selectedClass}
            onChange={(event) => setSelectedClass(event.target.value)}
            required
          >
            <option value="all" disabled>Select a class</option>
            {classesWithStudents.map((className) => (
              <option key={className} value={className}>{className}</option>
            ))}
          </select>
        </label>
        <label>
          Subject
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="e.g. Mathematics"
            maxLength="120"
            required
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={submitting || selectedClass === 'all'}>
          {submitting ? 'Starting...' : 'Start attendance session'}
        </button>
      </form>

      {message && <p className={`scan-message ${message.type}`} role="status">{message.text}</p>}

      <div className="active-sessions">
        <h3>Active sessions</h3>
        {activeSessions.length === 0 && <p>No active session. Start one to show a session QR.</p>}
        {activeSessions.map((session) => (
          <article className="active-session-card" key={session.id}>
            <div className="active-session-details">
              <h4>{session.className} · {session.subject}</h4>
              <p>Started: {new Date(session.startedAt).toLocaleString()}</p>
              <p>QR expires: {new Date(session.expiresAt).toLocaleString()}</p>
              <p><strong>Present: {session.presentCount}</strong></p>
              <p><strong>Absent: {session.absentCount}</strong></p>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleEndSession(session.id)}
                disabled={endingId === session.id}
              >
                {endingId === session.id ? 'Ending...' : 'End session'}
              </button>
            </div>
            <div className="session-qr">
              <p>Students: scan this QR with your phone camera.</p>
              {session.attendanceUrl
                ? <SessionQrCode url={session.attendanceUrl} />
                : <p role="alert">Session URL could not be created. Check PUBLIC_APP_URL on the server.</p>}
            </div>
            <div className="session-attendees">
              <h4>Present students ({session.presentCount})</h4>
              {session.presentCount === 0
                ? <p>Waiting for student check-ins.</p>
                : (
                  <ul>
                    {session.attendance.filter((record) => record.status === 'present').map((record) => (
                      <li key={record.id || `${record.sessionId}-${record.studentId}`}>
                        <strong>{record.studentName}</strong> · {record.rollNo}
                        <span>{record.timestamp ? new Date(record.timestamp).toLocaleTimeString() : ''}</span>
                      </li>
                    ))}
                  </ul>
                )}
              {session.absentCount > 0 && (
                <>
                  <h4>Absent students ({session.absentCount})</h4>
                  <ul>
                    {session.attendance.filter((record) => record.status === 'absent').map((record) => (
                      <li key={record.id || `${record.sessionId}-${record.studentId}`}>
                        <strong>{record.studentName}</strong> · {record.rollNo}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="attendance-list">
        <h3>Today's attendance by student</h3>
        {filteredStudents.map((student) => {
          const record = attendanceByStudent[student.id];
          return (
            <div className={`attendance-item ${record?.status || ''}`} key={student.id}>
              <div className="attendance-student-info">
                <span className="attendance-roll">{student.rollNo}</span>
                <span className="attendance-name">{student.name}</span>
                <span className="attendance-class">{student.class}</span>
              </div>
              <span className={`attendance-status ${record ? 'marked' : ''}`}>
                {record?.status === 'present'
                  ? `✅ ${record.subject || 'Present'}`
                  : record?.status === 'absent'
                    ? '❌ Absent'
                    : '⌛ Not marked'}
              </span>
            </div>
          );
        })}
        {filteredStudents.length === 0 && <div className="empty-state">No registered students in this class.</div>}
      </div>
    </section>
  );
};

export default AttendanceForm;
