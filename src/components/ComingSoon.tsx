import Icon, { type IconName } from './Icon';

interface ComingSoonProps {
  icon: IconName;
  title: string;
  intro: string;
  items?: string[];
}

// Designed empty state for features that arrive in a later phase.
export default function ComingSoon({ icon, title, intro, items = [] }: ComingSoonProps) {
  return (
    <section className="page">
      <h1 className="page-title">{title}</h1>
      <div className="coming-soon">
        <span className="coming-soon-icon"><Icon name={icon} size={28} /></span>
        <p className="coming-soon-lead">{intro}</p>
        {items.length > 0 && (
          <ul className="coming-soon-list">
            {items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}
        <p className="coming-soon-note">Coming soon</p>
      </div>
    </section>
  );
}
