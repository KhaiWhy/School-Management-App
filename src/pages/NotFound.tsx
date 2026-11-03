import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="page">
      <h1 className="page-title">Page not found</h1>
      <p className="empty">
        That page doesn't exist. <Link to="/">Back to home</Link>
      </p>
    </section>
  );
}
