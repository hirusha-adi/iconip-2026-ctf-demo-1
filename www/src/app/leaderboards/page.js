import AppHeader from '@/components/AppHeader';
import { requirePageUser } from '@/lib/server/authz';
import { getLeaderboardSnapshot } from '@/lib/server/db';

export default async function LeaderboardsPage() {
  const { userId, profile } = await requirePageUser();
  const snapshot = await getLeaderboardSnapshot({ viewerUserId: userId, limit: 200 });

  return (
    <main className="flex flex-1">
      <div className="cyber-page-shell">
        <AppHeader profile={profile} active="leaderboards" title="Leaderboards" />

        <section className="cyber-page-content space-y-4">
          <article className="cyber-card p-4">
            <p className="cyber-kicker">Ranking</p>
            <h1 className="cyber-title mt-2 text-2xl font-semibold text-foreground">User Score Leaderboard</h1>
            <p className="cyber-muted mt-1 text-sm">
              Rankings are based on accumulated persuasion points extracted from assistant responses.
            </p>
            <p className="cyber-muted mt-1 text-xs">
              Total ranked users: {Number(snapshot.totalParticipants || 0).toLocaleString()}
            </p>
          </article>

          {snapshot.viewer ? (
            <article className="cyber-card p-4">
              <p className="cyber-kicker">Your Position</p>
              <p className="cyber-title mt-1 text-lg font-semibold text-foreground">
                Rank #{snapshot.viewer.rank || '—'} · {Number(snapshot.viewer.points || 0).toLocaleString()} pts
              </p>
            </article>
          ) : null}

          <div className="cyber-table-wrap cyber-scroll">
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>User</th>
                  <th>Email</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.leaderboard.map((entry) => (
                  <tr key={entry.clerkUserId}>
                    <td>#{entry.rank}</td>
                    <td>{entry.displayName}</td>
                    <td>{entry.email || '—'}</td>
                    <td>{Number(entry.points || 0).toLocaleString()}</td>
                  </tr>
                ))}
                {!snapshot.leaderboard.length ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm cyber-muted">
                      No leaderboard data yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
