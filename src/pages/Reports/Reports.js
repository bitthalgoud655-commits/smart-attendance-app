import React from 'react';
import AttendanceList from '../../components/AttendanceList/AttendanceList';
import { useApp } from '../../context/AppContext';
import './Reports.css';

const Reports = () => {
  const { students, attendanceRecords, attendanceSessions } = useApp();

  const exportSession = (session) => {
    const columns = ['Full name', 'College roll number / student ID', 'Session ID', 'Class', 'Subject', 'Date', 'Status', 'Timestamp'];
    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = session.attendance.map((record) => [
      record.studentName,
      record.rollNo,
      session.id,
      session.className,
      session.subject,
      session.date,
      record.status,
      record.timestamp,
    ]);
    const csv = [columns, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-${session.className}-${session.subject}-${session.date}.csv`.replace(/[^a-z0-9_.-]/gi, '_');
    link.click();
    URL.revokeObjectURL(url);
  };

  // Calculate per-student stats
  const studentStats = students.map((student) => {
    const records = attendanceRecords.filter(
      (r) => r.studentId === student.id
    );
    const total = records.length;
    const present = records.filter((r) => r.status === 'present').length;
    const absent = records.filter((r) => r.status === 'absent').length;
    const late = records.filter((r) => r.status === 'late').length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    return {
      ...student,
      total,
      present,
      absent,
      late,
      percentage,
    };
  });

  // Sort by attendance percentage (lowest first for alerts)
  const sortedStats = [...studentStats].sort(
    (a, b) => a.percentage - b.percentage
  );

  const lowAttendance = sortedStats.filter(
    (s) => s.total > 0 && s.percentage < 75
  );

  return (
    <div className="reports-page">
      <h1 className="page-title">📊 Attendance Reports</h1>

      <section className="session-reports-section">
        <h2>Attendance session history</h2>
        {attendanceSessions.length === 0 && <p>No attendance sessions have been created yet.</p>}
        {attendanceSessions.map((session) => (
          <details className="session-report-card" key={session.id}>
            <summary>
              <span>{session.className} · {session.subject} · {session.date}</span>
              <span>{session.presentCount} present · {session.absentCount} absent · {session.status}</span>
            </summary>
            <div className="session-report-details">
              <p>Teacher: {session.teacher}</p>
              <p>Started: {new Date(session.startedAt).toLocaleString()}</p>
              <p>Expires: {new Date(session.expiresAt).toLocaleString()}</p>
              {session.endedAt && <p>Ended: {new Date(session.endedAt).toLocaleString()}</p>}
              <button type="button" className="btn btn-primary" onClick={() => exportSession(session)}>
                Export session CSV
              </button>
              {session.attendance.length === 0
                ? <p>No students checked in for this session.</p>
                : (
                  <div className="report-table-wrapper">
                    <table className="report-table">
                      <thead>
                        <tr><th>Full name</th><th>Roll no. / Student ID</th><th>Status</th><th>Timestamp</th></tr>
                      </thead>
                      <tbody>
                        {session.attendance.map((record) => (
                          <tr key={record.id || `${record.sessionId}-${record.studentId}`}>
                            <td>{record.studentName}</td>
                            <td>{record.rollNo}</td>
                            <td>{record.status === 'absent' ? 'Absent' : 'Present'}</td>
                            <td>{record.timestamp ? new Date(record.timestamp).toLocaleString() : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          </details>
        ))}
      </section>

      {lowAttendance.length > 0 && (
        <div className="alert-section">
          <h3>⚠️ Low Attendance Alert</h3>
          <div className="alert-cards">
            {lowAttendance.map((s) => (
              <div key={s.id} className="alert-card">
                <div className="alert-info">
                  <span className="alert-name">{s.name}</span>
                  <span className="alert-class">
                    {s.class} | Roll: {s.rollNo}
                  </span>
                </div>
                <div className={`alert-percentage ${s.percentage < 50 ? 'critical' : 'warning'}`}>
                  {s.percentage}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="student-report-section">
        <h3>📈 Student-wise Summary</h3>
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Class</th>
                <th>Total Days</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Late</th>
                <th>Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {studentStats.map((s) => (
                <tr key={s.id}>
                  <td className="student-name">{s.name}</td>
                  <td>
                    <span className="class-badge">{s.class}</span>
                  </td>
                  <td>{s.total}</td>
                  <td className="text-green">{s.present}</td>
                  <td className="text-red">{s.absent}</td>
                  <td className="text-yellow">{s.late}</td>
                  <td>
                    <div className="percentage-bar-cell">
                      <div className="mini-bar">
                        <div
                          className="mini-bar-fill"
                          style={{
                            width: `${s.percentage}%`,
                            background:
                              s.percentage >= 75
                                ? '#48bb78'
                                : s.percentage >= 50
                                ? '#ecc94b'
                                : '#e53e3e',
                          }}
                        ></div>
                      </div>
                      <span className="percentage-text">{s.percentage}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="records-section">
        <AttendanceList />
      </div>
    </div>
  );
};

export default Reports;
