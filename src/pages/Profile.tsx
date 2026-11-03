import { useUser } from '../auth/AuthContext';

export default function Profile() {
  const user = useUser();
  return (
    <section className="page">
      <h1 className="page-title">Profile</h1>
      <div className="profile-card">
        <img src="/profile.png" alt="" width="96" height="96" />
        <dl>
          <dt>Name</dt>
          <dd>{user.name}</dd>
          <dt>Role</dt>
          <dd className="capitalise">{user.role}</dd>
        </dl>
      </div>
      <p className="empty">Editing your profile and photo comes with real accounts.</p>
    </section>
  );
}
