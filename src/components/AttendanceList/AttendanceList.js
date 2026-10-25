import React from 'react';
import { useApp } from '../../context/AppContext';
import './AttendanceList.css';

const AttendanceList = () => {
  const {
    students,
    attendanceRecords,
    selectedDate,
    setSelectedDate,
    selectedClass,
    setSelectedClass,
    settings,
  } = useApp();

  // Get unique dates for navigation
  const uniqueDates = [...new Set(attendanceRecords.map((r) => r.date))].sort(
    (a, b) => new Date(b) - new Date(a)
  );

  // Get records for selected date
  const dateRecords = attendanceRecords.filter((r) => r.date === selectedDate);

  // Apply class filter
  const filteredRecords =
    selectedClass === 'all'
      ? dateRecords
      : dateRecords.filter((r) => r.class === selectedClass);

  const getStatusEmoji = (status) => {
    switch (status) {
      case 'present':
        return '✅';
      case 'absent':
        return '❌';
      case 'late':
        return '⏰';
      default:
        return '❓';
    }
  };

  return (
    <div className="attendance-list-container">
      <div className="attendance-list-header">
        <h2>📋 Attendance Records</h2>
        <div className="attendance-list-controls">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="date-picker"
          />
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="class-filter"
          >
            <option value="all">All Classes</option>
            {settings.classOptions.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>
      </div>

      {uniqueDates.length > 0 && (
        <div className="date-chips">
          {uniqueDates.slice(0, 7).map((date) => (
            <button
              key={date}
              className={`date-chip ${date === selectedDate ? 'active' : ''}`}
              onClick={() => setSelectedDate(date)}
            >
              {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              })}
            </button>
          ))}
        </div>
      )}

      {filteredRecords.length > 0 ? (
        <div className="records-table-wrapper">
          <table className="records-table">
            <thead>
              <tr>
                <th>Roll No</th>
                <th>Name</th>
                <th>Class</th>
                  <th>Status</th>
                  <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record, index) => (
                <tr key={index} className={`record-row ${record.status}`}>
                  <td>
                    <span className="badge">{record.rollNo}</span>
                  </td>
                  <td className="student-name">{record.studentName}</td>
                  <td>
                    <span className="class-badge">{record.class}</span>
                  </td>
                  <td>
                    <span className={`status-chip ${record.status}`}>
                      {getStatusEmoji(record.status)}{' '}
                      {record.status.charAt(0).toUpperCase() +
                        record.status.slice(1)}
                    </span>
                  </td>
                  <td>{record.reason ? record.reason : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <span style={{ fontSize: '3rem' }}>📭</span>
          <p>No attendance records for this date.</p>
          <p className="hint">
            Go to Home page to mark attendance first.
          </p>
        </div>
      )}
    </div>
  );
};

export default AttendanceList;
