import React from 'react';
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Navbar from './components/Navbar/Navbar';
import Home from './pages/Home/Home';
import Login from './pages/Login/Login';
import Reports from './pages/Reports/Reports';
import Settings from './pages/Settings/Settings';
import StudentScan from './pages/StudentScan/StudentScan';
import './App.css';

const TeacherPortal = () => {
  const { authLoading, teacher, isLoaded, dataError } = useApp();
  const location = useLocation();

  if (authLoading) return <main className="main-content">Checking teacher login...</main>;
  if (!teacher) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!isLoaded) {
    return <main className="main-content" role="alert">
      {dataError || 'Loading attendance data...'}
    </main>;
  }

  return (
    <div className="App">
      <Navbar />
      {dataError && <p className="main-content" role="status">{dataError}</p>}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};

const PortalRoutes = () => {
  const location = useLocation();
  if (location.pathname === '/student-scan') return <StudentScan />;
  if (location.pathname === '/login') return <Login />;
  return <TeacherPortal />;
};

const App = () => (
  <Router>
    <AppProvider>
      <PortalRoutes />
    </AppProvider>
  </Router>
);

export default App;
