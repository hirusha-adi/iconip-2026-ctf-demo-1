import AppHeader from "@/components/AppHeader";
import UserSettingsClient from "@/components/UserSettingsClient";
import { requirePageUser } from "@/lib/server/authz";

export default async function UserPage() {
  const { profile } = await requirePageUser();

  return (
    <main className="flex flex-1">
      <div className="cyber-page-shell">
        <AppHeader profile={profile} active="user" title="User Settings" />

        <div className="cyber-page-content">
          <UserSettingsClient
            initialFirstName={profile.first_name}
            initialLastName={profile.last_name}
            initialEmail={profile.email}
          />
        </div>
      </div>
    </main>
  );
}
