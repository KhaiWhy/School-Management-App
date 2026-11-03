import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { listClassrooms } from '../data/store';
import type { Classroom as ClassroomData } from '../data/types';
import { useUser } from '../auth/AuthContext';
import ComingSoon from '../components/ComingSoon';
import NotFound from './NotFound';

export default function Classroom() {
  const { id } = useParams();
  const user = useUser();
  // undefined = still loading, null = no such classroom
  const [room, setRoom] = useState<ClassroomData | null | undefined>(undefined);

  useEffect(() => {
    listClassrooms().then((rooms) => setRoom(rooms.find((r) => r.id === id) ?? null));
  }, [id]);

  if (room === undefined) return null;
  if (room === null) return <NotFound />;

  return (
    <ComingSoon
      icon="classroom"
      title={room.name}
      intro={
        user.role === 'teacher'
          ? 'Your class space: post work and materials for this class in one place.'
          : 'Everything for this class in one place.'
      }
      items={['Class stream and announcements', 'Assignments and due dates', 'Lesson materials', 'Class members']}
    />
  );
}
