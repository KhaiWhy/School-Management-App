import { useEffect, useState, type ReactNode } from 'react';
import { listMyClasses } from '../data/classes';
import type { ClassRoom } from '../data/types';
import { useUser } from '../auth/AuthContext';

export function ErrorNote({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return (
    <p className="error-note" role="alert">
      {error}
    </p>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <p className="empty">{label}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="page-header">
      <h1 className="page-title">{title}</h1>
      {children}
    </div>
  );
}

// Drop-down of your classes. `teachingOnly` limits it to classes you can manage.
export function ClassPicker({
  value,
  onChange,
  teachingOnly = false,
  id = 'class-picker',
  label = 'Class',
}: {
  value: string;
  onChange: (classId: string, classRoom: ClassRoom | undefined) => void;
  teachingOnly?: boolean;
  id?: string;
  label?: string;
}) {
  const user = useUser();
  const [classes, setClasses] = useState<ClassRoom[] | null>(null);

  useEffect(() => {
    listMyClasses()
      .then((all) =>
        setClasses(teachingOnly && user.role !== 'admin' ? all.filter((c) => c.teacher_id === user.id) : all),
      )
      .catch(() => setClasses([]));
  }, [teachingOnly, user.id, user.role]);

  useEffect(() => {
    if (classes && classes.length > 0 && !classes.some((c) => c.id === value)) {
      onChange(classes[0].id, classes[0]);
    }
  }, [classes, value, onChange]);

  if (classes === null) return <Loading label="Loading classes…" />;
  if (classes.length === 0) {
    return <Empty>{teachingOnly ? 'Create a class first (Classes page).' : 'Join a class first.'}</Empty>;
  }

  return (
    <label className="field" htmlFor={id}>
      {label}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value, classes.find((c) => c.id === e.target.value))}
      >
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
