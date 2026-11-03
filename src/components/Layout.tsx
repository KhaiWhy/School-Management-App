import { createContext, useContext } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '../auth/AuthContext';
import { listMyClasses } from '../data/classes';
import type { ClassRoom, Role } from '../data/types';
import { useTheme } from '../lib/theme';
import { useLoad } from '../lib/useLoad';
import Avatar from './Avatar';
import Icon, { type IconName } from './Icon';

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  roles?: Role[];
}

// Side rail, grouped. `roles` limits a link to those roles; no `roles` = everyone.
export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Learn',
    items: [
      { to: '/', label: 'Home', icon: 'home', end: true },
      { to: '/classes', label: 'Classes', icon: 'classroom' },
      { to: '/assignments', label: 'Assignments', icon: 'assignment' },
      { to: '/materials', label: 'Materials', icon: 'material' },
    ],
  },
  {
    title: 'Schedule',
    items: [
      { to: '/timetable', label: 'Timetable', icon: 'timetable' },
      { to: '/calendar', label: 'Calendar', icon: 'calendar' },
      { to: '/activities', label: 'Activities', icon: 'activity' },
    ],
  },
  { title: 'Talk', items: [{ to: '/messages', label: 'Messages', icon: 'message' }] },
  {
    title: 'Records',
    items: [
      { to: '/attendance', label: 'Attendance', icon: 'attendance' },
      { to: '/reports', label: 'Reports', icon: 'report' },
    ],
  },
  { title: 'Admin', items: [{ to: '/people', label: 'People', icon: 'people', roles: ['admin'] }] },
];

// Phone bottom bar: the five places people go most. Everything else is under More.
const TABS: NavItem[] = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/classes', label: 'Classes', icon: 'classroom' },
  { to: '/assignments', label: 'Work', icon: 'assignment' },
  { to: '/messages', label: 'Messages', icon: 'message' },
  { to: '/more', label: 'More', icon: 'more' },
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

export function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  const next = resolved === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" className="icon-button" onClick={toggle} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      <Icon name={resolved === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

export default function Layout() {
  const { signOut } = useAuth();
  const user = useUser();
  const navigate = useNavigate();
  const { data: classes = [], reload: reloadClasses } = useLoad(listMyClasses, [user.id]);
  const name = user.full_name || user.username;

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.includes(user.role)) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <ClassesContext.Provider value={{ classes, reloadClasses }}>
      <div className="app">
        <a className="skip-link" href="#main">Skip to content</a>

        <header className="topbar">
          <Link to="/" className="brand">Schooling</Link>
          <div className="topbar-user">
            <ThemeToggle />
            <span className="badge badge-info role-badge">{ROLE_LABEL[user.role]}</span>
            <Link to="/profile" className="topbar-avatar" aria-label={`Profile: ${name}`}>
              <Avatar name={name} />
            </Link>
          </div>
        </header>

        <nav className="rail" aria-label="Main">
          <div className="rail-groups">
            {groups.map((g) => (
              <div key={g.title} className="rail-group">
                <p className="rail-group-title">{g.title}</p>
                <ul>
                  {g.items.map((item) => (
                    <li key={item.to}>
                      <NavLink to={item.to} end={item.end} className="rail-link">
                        <Icon name={item.icon} />
                        <span>{item.label}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="rail-me">
            <Link to="/profile" className="rail-me-link">
              <Avatar name={name} size={32} />
              <span className="rail-me-text">
                <strong>{name}</strong>
                <small>{ROLE_LABEL[user.role]}</small>
              </span>
            </Link>
            <button type="button" className="icon-button" onClick={handleSignOut} aria-label="Sign out" title="Sign out">
              <Icon name="logout" size={18} />
            </button>
          </div>
        </nav>

        <aside className="classes" aria-label="Classrooms">
          <h2 className="classes-title">Classrooms</h2>
          <ul>
            {classes.map((room) => (
              <li key={room.id}>
                <NavLink to={`/classroom/${room.id}`} className="classroom-link">
                  <span className="class-mark"><Icon name="classroom" size={18} /></span>
                  <span className="classroom-text">
                    <strong>{room.name}</strong>
                    <small>{room.teacher_id === user.id ? room.subject || 'You teach this' : room.teacher?.full_name}</small>
                  </span>
                </NavLink>
              </li>
            ))}
            <li>
              <Link to="/classes" className="classroom-add">
                <Icon name="plus" size={18} />
                <span>{user.role === 'student' ? 'Join a class' : 'New class'}</span>
              </Link>
            </li>
          </ul>
        </aside>

        <main id="main" className="content" tabIndex={-1}>
          <Outlet />
        </main>

        <nav className="tabbar" aria-label="Main (phone)">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className="tabbar-link">
              <Icon name={t.icon} size={22} />
              <span>{t.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </ClassesContext.Provider>
  );
}
