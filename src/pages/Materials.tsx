import { useUser } from '../auth/AuthContext';
import ComingSoon from '../components/ComingSoon';

export default function Materials() {
  const user = useUser();
  return (
    <ComingSoon
      icon="material"
      title="Class materials"
      intro={
        user.role === 'teacher'
          ? 'Upload lesson slides, notes and worksheets for your classes.'
          : 'Lesson slides, notes and worksheets your teachers have shared.'
      }
      items={['Grouped by class', 'Download or open in the browser']}
    />
  );
}
