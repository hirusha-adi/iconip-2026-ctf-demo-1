import AppHeader from "@/components/AppHeader";
import LeaderboardsClient from "@/components/LeaderboardsClient";
import { requirePageUser } from "@/lib/server/authz";
import { getLeaderboardSnapshot } from "@/lib/server/db";

export default async function LeaderboardsPage() {
  const { userId, profile } = await requirePageUser();
  const snapshot = await getLeaderboardSnapshot({
    viewerUserId: userId,
    limit: 200,
  });

  return (
    <main className="flex flex-1">
      <div className="cyber-page-shell">
        <AppHeader
          profile={profile}
          active="leaderboards"
          title="Leaderboards"
        />

        <section className="cyber-page-content !mt-8 !mb-2">
          <LeaderboardsClient snapshot={snapshot} />
        </section>
      </div>
    </main>
  );
}
