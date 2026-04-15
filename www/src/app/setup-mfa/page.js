import SetupMfaClient from '@/components/SetupMfaClient';
import { requirePageUser } from '@/lib/server/authz';

export default async function SetupMfaPage() {
  await requirePageUser();

  return (
    <main className="flex flex-1 items-center">
      <div className="cyber-shell-narrow">
        <SetupMfaClient />
      </div>
    </main>
  );
}
