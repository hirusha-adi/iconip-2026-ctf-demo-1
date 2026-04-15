import AppHeader from '@/components/AppHeader';
import { Hash, Medal, Star, Trophy, UserRound, Users } from 'lucide-react';
import { requirePageUser } from '@/lib/server/authz';
import { getLeaderboardSnapshot } from '@/lib/server/db';

export default async function LeaderboardsPage() {
  const { userId, profile } = await requirePageUser();
  const snapshot = await getLeaderboardSnapshot({ viewerUserId: userId, limit: 200 });
  const topEntry = snapshot.leaderboard[0] ?? null;
  const viewerRank = snapshot.viewer?.rank ?? null;
  const viewerPoints = Number(snapshot.viewer?.points || 0);

  return (
    <main className="flex flex-1">
      <div className="cyber-page-shell">
        <AppHeader profile={profile} active="leaderboards" title="Leaderboards" />

        <section className="cyber-page-content space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="p-2">
              <p className="cyber-kicker">Leaderboard</p>
              <h1 className="cyber-title mt-2 flex items-center gap-2 text-2xl font-semibold text-foreground">
                <Trophy size={20} className="text-[#1f3b70]" />
                User Score Rankings
              </h1>
              <p className="cyber-muted mt-3 text-sm">
                Scores are cumulative points extracted from assistant responses across all sessions.
              </p>
              <p className="cyber-muted mt-2 text-sm">
                The table below updates as new scored responses are recorded.
              </p>
            </article>

            <article className="p-2">
              <div className="grid grid-cols-2 gap-3">
                <Stat
                  label="Total users"
                  value={Number(snapshot.totalParticipants || 0).toLocaleString()}
                  icon={<Users size={14} />}
                />
                <Stat label="Your rank" value={viewerRank ? `#${viewerRank}` : '—'} icon={<Medal size={14} />} />
                <Stat label="Your points" value={viewerPoints.toLocaleString()} icon={<Star size={14} />} />
                <Stat label="Top points" value={Number(topEntry?.points || 0).toLocaleString()} icon={<Trophy size={14} />} />
              </div>
            </article>
          </div>

          <div className="cyber-table-wrap cyber-scroll">
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>
                    <span className="inline-flex items-center gap-1">
                      <Hash size={12} />
                      Rank
                    </span>
                  </th>
                  <th>
                    <span className="inline-flex items-center gap-1">
                      <UserRound size={12} />
                      User
                    </span>
                  </th>
                  <th>
                    <span className="inline-flex items-center gap-1">
                      <Star size={12} />
                      Points
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {snapshot.leaderboard.map((entry) => (
                  <tr key={entry.clerkUserId}>
                    <td className="font-medium">
                      {entry.rank <= 3 ? (
                        <span className="inline-flex items-center gap-1">
                          <Medal size={12} className="text-[#1f3b70]" />
                          #{entry.rank}
                        </span>
                      ) : (
                        `#${entry.rank}`
                      )}
                    </td>
                    <td>{entry.displayName}</td>
                    <td>{Number(entry.points || 0).toLocaleString()}</td>
                  </tr>
                ))}
                {!snapshot.leaderboard.length ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-sm cyber-muted">
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

function Stat({ label, value, icon }) {
  return (
    <div className="rounded-xl border border-[rgba(21,40,82,0.18)] p-3">
      <p className="cyber-kicker text-[10px]">{label}</p>
      <p className="cyber-title mt-1 flex items-center gap-1.5 text-lg font-semibold text-foreground">
        <span className="text-[#1f3b70]">{icon}</span>
        {value}
      </p>
    </div>
  );
}
