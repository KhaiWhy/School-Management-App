import { useUser } from '../auth/AuthContext';
import MaterialList from '../components/MaterialList';
import { PageHeader } from '../components/ui';
import { isStaff } from '../lib/format';

export default function Materials() {
  const user = useUser();
  return (
    <section className="page">
      <PageHeader title="Class materials" />
      <MaterialList canAdd={isStaff(user.role)} />
    </section>
  );
}
