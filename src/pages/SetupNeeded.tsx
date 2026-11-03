// Shown when the Supabase keys are missing, instead of a broken app.
export default function SetupNeeded() {
  return (
    <main className="login">
      <div className="login-card">
        <h1 className="brand brand-large">Schooling</h1>
        <p className="login-lead">The app isn't connected to its database yet.</p>
        <ol className="setup-steps">
          <li>
            Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env.local</code>{' '}
            (on your computer) or to Render → Environment (live site).
          </li>
          <li>Restart <code>npm run dev</code>, or redeploy on Render with "Clear build cache".</li>
        </ol>
        <p className="login-note">Full steps: SUPABASE-SETUP.md in the project.</p>
      </div>
    </main>
  );
}
