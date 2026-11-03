import { useUser } from '../auth/AuthContext';
import ComingSoon from '../components/ComingSoon';

export default function Assignments() {
  const user = useUser();
  return user.role === 'teacher' ? (
    <ComingSoon
      icon="assignment"
      title="Assignments"
      intro="Set work for your classes and see who has handed it in."
      items={['Create an assignment with a due date', 'Attach files', 'See submissions and give feedback']}
    />
  ) : (
    <ComingSoon
      icon="assignment"
      title="Assignments"
      intro="All your work across every class, sorted by due date."
      items={['To do, done and overdue', 'Hand in work', 'Read teacher feedback']}
    />
  );
}
