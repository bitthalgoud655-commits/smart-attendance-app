import React from 'react';
import AttendanceList from '../../components/AttendanceList/AttendanceList';
import { useApp } from '../../context/AppContext';
import './Reports.css';

const Reports = () => {
  const { students, attendanceRecords } = useApp();

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
