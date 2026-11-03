import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import Classroom from './pages/Classroom';
import Assignments from './pages/Assignments';
import Materials from './pages/Materials';
import Timetable from './pages/Timetable';
import Calendar from './pages/Calendar';
import Activities from './pages/Activities';
import Messages from './pages/Messages';
import Attendance from './pages/Attendance';
import Reports from './pages/Reports';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route path="classroom/:id" element={<Classroom />} />
        <Route path="assignments" element={<Assignments />} />
        <Route path="materials" element={<Materials />} />
        <Route path="timetable" element={<Timetable />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="activities" element={<Activities />} />
        <Route path="messages" element={<Messages />} />
        <Route path="profile" element={<Profile />} />
        <Route
          path="attendance"
          element={<RequireAuth roles={['teacher']}><Attendance /></RequireAuth>}
        />
        <Route
          path="reports"
          element={<RequireAuth roles={['teacher']}><Reports /></RequireAuth>}
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
