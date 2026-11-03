// Initials in a soft circle ("Ms Lee" → "ML"). Used everywhere a person appears.
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export default function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.max(10, size * 0.34) }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
