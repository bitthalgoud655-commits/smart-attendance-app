import React from 'react';
import { useApp } from '../../context/AppContext';
import './Dashboard.css';

const Dashboard = () => {
  const { getStats, selectedDate, setSelectedDate } = useApp();
  const stats = getStats();

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>📊 Dashboard</h2>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="date-picker"
        />
      </div>

      <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <span className="stat-number">{stats.total}</span>
            <span className="stat-label">Total Students</span>
          </div>
        </div>

        <div className="stat-card present">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <span className="stat-number">{stats.present}</span>
            <span className="stat-label">Present</span>
          </div>
        </div>

        <div className="stat-card absent">
          <div className="stat-icon">❌</div>
          <div className="stat-info">
            <span className="stat-number">{stats.absent}</span>
            <span className="stat-label">Absent</span>
          </div>
        </div>

        <div className="stat-card late">
          <div className="stat-icon">⏰</div>
          <div className="stat-info">
            <span className="stat-number">{stats.late}</span>
            <span className="stat-label">Late</span>
          </div>
        </div>

        <div className="stat-card unmarked">
          <div className="stat-icon">❓</div>
          <div className="stat-info">
            <span className="stat-number">{stats.unmarked}</span>
            <span className="stat-label">Unmarked</span>
          </div>
        </div>
      </div>

      {stats.total > 0 && stats.unmarked < stats.total && (
        <div className="attendance-bar-container">
          <h3>Attendance Overview</h3>
          <div className="attendance-bar">
            {stats.present > 0 && (
              <div
                className="bar-segment present"
                style={{
                  width: `${(stats.present / stats.total) * 100}%`,
                }}
                title={`Present: ${stats.present}`}
              >
                {Math.round((stats.present / stats.total) * 100)}%
              </div>
            )}
            {stats.late > 0 && (
              <div
                className="bar-segment late"
                style={{
                  width: `${(stats.late / stats.total) * 100}%`,
                }}
                title={`Late: ${stats.late}`}
              >
                {Math.round((stats.late / stats.total) * 100)}%
              </div>
            )}
            {stats.absent > 0 && (
              <div
                className="bar-segment absent"
                style={{
                  width: `${(stats.absent / stats.total) * 100}%`,
                }}
                title={`Absent: ${stats.absent}`}
              >
                {Math.round((stats.absent / stats.total) * 100)}%
              </div>
            )}
          </div>
          <div className="bar-legend">
            <span className="legend-item">
              <span className="legend-dot present"></span> Present
            </span>
            <span className="legend-item">
              <span className="legend-dot late"></span> Late
            </span>
            <span className="legend-item">
              <span className="legend-dot absent"></span> Absent
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
