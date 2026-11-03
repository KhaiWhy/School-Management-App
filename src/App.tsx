import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/AuthContext';
import Layout from './components/Layout';
import { isConfigured } from './lib/supabase';
import Activities from './pages/Activities';
import AssignmentDetail from './pages/AssignmentDetail';
import Assignments from './pages/Assignments';
import Attendance from './pages/Attendance';
import Calendar from './pages/Calendar';
import Classes from './pages/Classes';
import Classroom from './pages/Classroom';
import Home from './pages/Home';
import Login from './pages/Login';
import Materials from './pages/Materials';
import Messages from './pages/Messages';
import More from './pages/More';
import NotFound from './pages/NotFound';
import People from './pages/People';
import Profile from './pages/Profile';
import Reports from './pages/Reports';
import ResetPassword from './pages/ResetPassword';
import SetupNeeded from './pages/SetupNeeded';
import Timetable from './pages/Timetable';

export default function App() {
  if (!isConfigured) return <SetupNeeded />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route path="classes" element={<Classes />} />
        <Route path="classroom/:id" element={<Classroom />} />
        <Route path="assignments" element={<Assignments />} />
        <Route path="assignments/:id" element={<AssignmentDetail />} />
        <Route path="materials" element={<Materials />} />
        <Route path="timetable" element={<Timetable />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="activities" element={<Activities />} />
        <Route path="messages" element={<Messages />} />
        <Route path="messages/:userId" element={<Messages />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="reports" element={<Reports />} />
        <Route path="profile" element={<Profile />} />
        <Route path="more" element={<More />} />
        <Route
          path="people"
          element={<RequireAuth roles={['admin']}><People /></RequireAuth>}
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
