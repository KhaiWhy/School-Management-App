import { useUser } from '../auth/AuthContext';
import Announcements from '../components/Announcements';

export default function Home() {
  const user = useUser();
  return (
    <div className="page">
      <p className="greeting">Hello, {user.name}</p>
      <Announcements canManage={user.role === 'teacher'} />
    </div>
  );
}
