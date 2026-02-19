import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import './Settings.css';

const Settings = () => {
  const { settings, updateSettings } = useApp();
  const [schoolName, setSchoolName] = useState(settings.schoolName);
  const [newClass, setNewClass] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSaveSchool = () => {
    updateSettings({ schoolName });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAddClass = () => {
    if (!newClass.trim()) return;
    if (settings.classOptions.includes(newClass.trim())) return;
    updateSettings({
      classOptions: [...settings.classOptions, newClass.trim()],
    });
    setNewClass('');
  };

  const handleRemoveClass = (cls) => {
    updateSettings({
      classOptions: settings.classOptions.filter((c) => c !== cls),
    });
  };

  const handleClearAllData = () => {
    if (
      window.confirm(
        'Are you sure? This will delete ALL attendance records and student data!'
      )
    ) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="settings-page">
      <h1 className="page-title">⚙️ Settings</h1>

      {/* School Name */}
      <div className="settings-card">
        <h3>🏫 School Name</h3>
        <div className="settings-input-group">
          <input
            type="text"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            placeholder="Enter school name"
            className="settings-input"
          />
          <button className="btn btn-primary" onClick={handleSaveSchool}>
            {saved ? '✅ Saved!' : '💾 Save'}
          </button>
        </div>
      </div>

      {/* Class Management */}
      <div className="settings-card">
        <h3>📚 Class Management</h3>
        <div className="class-tags">
          {settings.classOptions.map((cls) => (
            <span key={cls} className="class-tag">
              {cls}
              <button
                className="tag-remove"
                onClick={() => handleRemoveClass(cls)}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="settings-input-group">
          <input
            type="text"
            value={newClass}
            onChange={(e) => setNewClass(e.target.value)}
            placeholder="e.g., 11-C"
            className="settings-input"
            onKeyDown={(e) => e.key === 'Enter' && handleAddClass()}
          />
          <button className="btn btn-success" onClick={handleAddClass}>
            + Add Class
          </button>
        </div>
      </div>

      {/* Data Management */}
      <div className="settings-card danger-zone">
        <h3>🗑️ Danger Zone</h3>
        <p className="danger-text">
          This will permanently delete all student data, attendance records, and
          settings. This action cannot be undone.
        </p>
        <button className="btn btn-danger-big" onClick={handleClearAllData}>
          🗑️ Clear All Data
        </button>
      </div>

      {/* App Info */}
      <div className="settings-card">
        <h3>ℹ️ About</h3>
        <div className="about-info">
          <p>
            <strong>Smart Attendance App</strong>
          </p>
          <p>Version 1.0.0</p>
          <p>
            A simple and smart attendance management system built with React.
            Track student attendance, generate reports, and manage classes with
            ease.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
