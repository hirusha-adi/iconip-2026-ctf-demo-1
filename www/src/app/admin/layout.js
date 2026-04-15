import AppHeader from '@/components/AppHeader';
import { requirePageAdmin } from '@/lib/server/authz';

export default async function AdminLayout({ children }) {
  const { profile } = await requirePageAdmin();

  return (
    <div className="flex flex-1">
      <div className="cyber-page-shell">
        <AppHeader profile={profile} active="admin" title="Admin Panel" />

        <section className="cyber-page-content">{children}</section>
      </div>
    </div>
  );
}
