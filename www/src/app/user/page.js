import AppHeader from "@/components/AppHeader";
import UserSettingsClient from "@/components/UserSettingsClient";
import { requirePageUser } from "@/lib/server/authz";
import { getUserPersuasionPoints } from "@/lib/server/db";

export default async function UserPage() {
  const { userId, profile } = await requirePageUser();
  const userPoints = await getUserPersuasionPoints(userId);

  return (
    <main className="flex flex-1">
      <div className="cyber-page-shell">
        <AppHeader profile={profile} active="user" title="User Settings" />

        <div className="cyber-page-content">
          <UserSettingsClient
            initialFirstName={profile.first_name}
            initialLastName={profile.last_name}
            initialEmail={profile.email}
            userPoints={userPoints}
          />
        </div>
      </div>
    </main>
  );
}
