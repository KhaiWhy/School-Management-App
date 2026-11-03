import { useUser } from '../auth/AuthContext';
import AssignmentList from '../components/AssignmentList';
import { PageHeader } from '../components/ui';
import { isStaff } from '../lib/format';

export default function Assignments() {
  const user = useUser();
  return (
    <section className="page">
      <PageHeader title="Assignments" />
      <AssignmentList canCreate={isStaff(user.role)} />
    </section>
  );
}
