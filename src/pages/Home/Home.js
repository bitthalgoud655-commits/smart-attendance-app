import React from 'react';
import Dashboard from '../../components/Dashboard/Dashboard';
import AttendanceForm from '../../components/AttendanceForm/AttendanceForm';
import StudentList from '../../components/StudentList/StudentList';
import './Home.css';

const Home = () => {
  return (
    <div className="home-page">
      <Dashboard />
      <div className="home-grid">
        <div className="home-main">
          <AttendanceForm />
        </div>
        <div className="home-sidebar">
          <StudentList />
        </div>
      </div>
    </div>
  );
};

export default Home;
