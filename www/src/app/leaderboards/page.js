import AppHeader from "@/components/AppHeader";
import PublicHeader from "@/components/PublicHeader";
import LeaderboardsClient from "@/components/LeaderboardsClient";
import { getApiUserContext } from "@/lib/server/authz";
import { getLeaderboardSnapshot } from "@/lib/server/db";

export default async function LeaderboardsPage() {
  const { userId, profile } = await getApiUserContext();
  const snapshot = await getLeaderboardSnapshot({
    viewerUserId: userId,
    limit: 200,
  });

  return (
    <main className="flex flex-1">
      <div className="cyber-page-shell">
        {userId ? (
          <AppHeader profile={profile} active="leaderboards" title="Leaderboards" />
        ) : (
          <PublicHeader active="leaderboards" />
        )}

        <section className="cyber-page-content !mt-8 !mb-2">
          <LeaderboardsClient snapshot={snapshot} isViewerLoggedIn={Boolean(userId)} />
        </section>
      </div>
    </main>
  );
}
