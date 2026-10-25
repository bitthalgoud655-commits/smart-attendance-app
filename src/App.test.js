import { render, screen } from '@testing-library/react';
import { AppProvider, useApp } from './context/AppContext';

const AuthStatus = () => {
  const { authLoading, teacher } = useApp();
  if (authLoading) return <p>Checking login</p>;
  return <p>{teacher ? 'Teacher signed in' : 'Sign in required'}</p>;
};

test('starts unauthenticated when no teacher token exists', async () => {
  sessionStorage.removeItem('smart_attendance_teacher_token');
  render(<AppProvider><AuthStatus /></AppProvider>);
  expect(await screen.findByText('Sign in required')).toBeInTheDocument();
});
