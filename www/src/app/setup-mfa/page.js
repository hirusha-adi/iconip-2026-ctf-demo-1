import SetupMfaClient from '@/components/SetupMfaClient';
import AppHeader from '@/components/AppHeader';
import { requirePageUser } from '@/lib/server/authz';

export default async function SetupMfaPage() {
  const { profile } = await requirePageUser();

  return (
    <main className="flex flex-1">
      <div className="cyber-page-shell">
        <AppHeader profile={profile} active="user" title="Security Settings" />

        <section className="cyber-page-content grid gap-4 lg:grid-cols-[minmax(0,680px)_minmax(0,1fr)] lg:items-start">
          <SetupMfaClient />

          <aside className="cyber-card p-6">
            <p className="cyber-kicker">MFA</p>
            <h2 className="cyber-title mt-2 text-xl font-semibold text-foreground">Authenticator + backup codes</h2>
            <p className="cyber-muted mt-2 text-sm">
              Complete authenticator setup, verify one code, then save backup codes before returning to chat.
            </p>
          </aside>
        </section>
      </div>
    </main>
  );
}
