import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '../auth/AuthContext';
import Icon from '../components/Icon';
import { NAV_GROUPS } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { useTheme, type ThemeChoice } from '../lib/theme';

// Phone only: everything that isn't in the bottom tab bar.
const IN_TAB_BAR = new Set(['/', '/classes', '/assignments', '/messages']);

export default function More() {
  const user = useUser();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { choice, setChoice } = useTheme();

  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !IN_TAB_BAR.has(i.to) && (!i.roles || i.roles.includes(user.role))),
  })).filter((g) => g.items.length > 0);

  return (
    <section className="page">
      <PageHeader title="More" />
      {groups.map((g) => (
        <div key={g.title} className="more-group">
          <h2 className="rail-group-title">{g.title}</h2>
          <ul className="more-list">
            {g.items.map((i) => (
              <li key={i.to}>
                <Link to={i.to} className="more-link">
                  <Icon name={i.icon} />
                  <span>{i.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="more-group">
        <h2 className="rail-group-title">You</h2>
        <ul className="more-list">
          <li>
            <Link to="/profile" className="more-link">
              <Icon name="profile" />
              <span>Profile</span>
            </Link>
          </li>
          <li className="more-link more-appearance">
            <Icon name="moon" />
            <span>Appearance</span>
            <ThemePicker value={choice} onChange={setChoice} />
          </li>
          <li>
            <Link to="/privacy" className="more-link">
              <Icon name="file" />
              <span>Privacy</span>
            </Link>
          </li>
          <li>
            <button
              type="button"
              className="more-link"
              onClick={async () => {
                await signOut();
                navigate('/login');
              }}
            >
              <Icon name="logout" />
              <span>Sign out</span>
            </button>
          </li>
        </ul>
      </div>
    </section>
  );
}

export function ThemePicker({ value, onChange }: { value: ThemeChoice; onChange: (v: ThemeChoice) => void }) {
  return (
    <div className="segmented segmented-small" role="radiogroup" aria-label="Appearance">
      {(['light', 'dark', 'system'] as const).map((v) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>
          {v === 'system' ? 'System' : v === 'light' ? 'Light' : 'Dark'}
        </button>
      ))}
    </div>
  );
}
