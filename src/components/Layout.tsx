import { createContext, useContext } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '../auth/AuthContext';
import { listMyClasses } from '../data/classes';
import type { ClassRoom, Role } from '../data/types';
import { useLoad } from '../lib/useLoad';
import Icon, { type IconName } from './Icon';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  roles?: Role[];
}

// Side rail links. `roles` limits a link to those roles; no `roles` = everyone.
const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/classes', label: 'Classes', icon: 'classroom' },
  { to: '/assignments', label: 'Assignments', icon: 'assignment' },
  { to: '/materials', label: 'Materials', icon: 'material' },
  { to: '/timetable', label: 'Timetable', icon: 'timetable' },
  { to: '/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/activities', label: 'Activities', icon: 'activity' },
  { to: '/messages', label: 'Messages', icon: 'message' },
  { to: '/attendance', label: 'Attendance', icon: 'attendance' },
  { to: '/reports', label: 'Reports', icon: 'report' },
  { to: '/people', label: 'People', icon: 'people', roles: ['admin'] },
];

const ROLE_LABEL: Record<Role, string> = { student: 'Student', teacher: 'Teacher', admin: 'Admin' };

// Lets any page refresh the classroom list (after creating, joining or leaving a class).
const ClassesContext = createContext<{ classes: ClassRoom[]; reloadClasses: () => Promise<void> }>({
  classes: [],
  reloadClasses: async () => {},
});

export function useClasses() {
  return useContext(ClassesContext);
}

export default function Layout() {
  const { signOut } = useAuth();
  const user = useUser();
  const navigate = useNavigate();
  const { data: classes = [], reload: reloadClasses } = useLoad(listMyClasses, [user.id]);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  const links = NAV.filter((item) => !item.roles || item.roles.includes(user.role));

  return (
    <ClassesContext.Provider value={{ classes, reloadClasses }}>
      <div className="app">
        <a className="skip-link" href="#main">Skip to content</a>

        <header className="topbar">
          <Link to="/" className="brand">Schooling</Link>
          <div className="topbar-user">
            <span className="role-chip">{ROLE_LABEL[user.role]}</span>
            <Link to="/profile" className="profile" aria-label={`Profile: ${user.full_name || user.username}`}>
              <img src="/profile.png" alt="" width="40" height="40" />
            </Link>
          </div>
        </header>

        <nav className="rail" aria-label="Main">
          <ul>
            {links.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className="rail-link" title={item.label}>
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
          <button type="button" className="rail-link rail-signout" onClick={handleSignOut} title="Sign out">
            <Icon name="logout" />
            <span>Sign out</span>
          </button>
        </nav>

        <main id="main" className="content" tabIndex={-1}>
          <Outlet />
        </main>

        <aside className="classes" aria-label="Classrooms">
          <h2 className="classes-title">Classrooms</h2>
          <ul>
            {classes.map((room) => (
              <li key={room.id}>
                <NavLink to={`/classroom/${room.id}`} className="classroom-link">
                  <Icon name="classroom" size={18} />
                  <span>{room.name}</span>
                </NavLink>
              </li>
            ))}
            <li>
              <Link to="/classes" className="classroom-link classroom-add">
                <span aria-hidden="true">+</span>
                <span>{user.role === 'student' ? 'Join a class' : 'New class'}</span>
              </Link>
            </li>
          </ul>
        </aside>
      </div>
    </ClassesContext.Provider>
  );
}
