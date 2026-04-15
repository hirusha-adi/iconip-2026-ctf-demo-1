"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  BarChart3,
  Hash,
  Medal,
  PieChart,
  Star,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";

const ReactECharts = dynamic(
  () => import("echarts-for-react").then((mod) => mod.default),
  {
    ssr: false,
  },
);

const PIE_COLORS = [
  "#152852",
  "#1f3b70",
  "#2a4c8a",
  "#3b5f9f",
  "#4b71b4",
  "#5b82c7",
  "#6b92d5",
  "#7aa0de",
  "#8caee5",
  "#9bb8ea",
  "#c1d1ee",
];

function buildPieSegments(leaderboard) {
  const ranked = (leaderboard || [])
    .map((entry) => ({
      label: entry.displayName || "Participant",
      points: Number(entry.points || 0),
    }))
    .filter((entry) => entry.points > 0);

  if (!ranked.length) {
    return { total: 0, segments: [] };
  }

  const topTen = ranked.slice(0, 10);
  const othersPoints = ranked
    .slice(10)
    .reduce((sum, entry) => sum + entry.points, 0);

  const base = [...topTen];
  if (othersPoints > 0) {
    base.push({
      label: "Others",
      points: othersPoints,
    });
  }

  const total = base.reduce((sum, entry) => sum + entry.points, 0);

  const segments = base.map((entry, index) => {
    return {
      id: `${entry.label}-${index}`,
      label: entry.label,
      points: entry.points,
      percent: (entry.points / total) * 100,
      color: PIE_COLORS[index % PIE_COLORS.length],
    };
  });

  return { total, segments };
}

export default function LeaderboardsClient({ snapshot }) {
  const [view, setView] = useState("stats");
  const [hoveredSlice, setHoveredSlice] = useState(null);
  const topEntry = snapshot.leaderboard[0] ?? null;
  const viewerRank = snapshot.viewer?.rank ?? null;
  const viewerPoints = Number(snapshot.viewer?.points || 0);

  const { total, segments } = useMemo(
    () => buildPieSegments(snapshot.leaderboard),
    [snapshot.leaderboard],
  );

  const pieHoverText = hoveredSlice
    ? `${hoveredSlice.label}: ${hoveredSlice.points.toLocaleString()} pts (${hoveredSlice.percent.toFixed(1)}%)`
    : "Hover a slice to see contributor details.";

  const pieOption = useMemo(
    () => ({
      backgroundColor: "transparent",
      color: segments.map((segment) => segment.color),
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(20,32,58,0.92)",
        borderColor: "rgba(155,184,234,0.5)",
        textStyle: {
          color: "#eaf0ff",
          fontSize: 12,
        },
        formatter: (params) =>
          `${params.name}<br/>${Number(params.value || 0).toLocaleString()} pts (${Number(params.percent || 0).toFixed(1)}%)`,
      },
      series: [
        {
          type: "pie",
          radius: ["42%", "78%"],
          center: ["50%", "52%"],
          avoidLabelOverlap: true,
          minAngle: 3,
          itemStyle: {
            borderRadius: 10,
            borderColor: "rgba(224,229,236,0.95)",
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          labelLine: {
            show: false,
          },
          emphasis: {
            scale: true,
            scaleSize: 6,
            itemStyle: {
              shadowBlur: 12,
              shadowColor: "rgba(21,40,82,0.28)",
            },
          },
          data: segments.map((segment) => ({
            name: segment.label,
            value: segment.points,
          })),
        },
      ],
    }),
    [segments],
  );

  const pieEvents = {
    mouseover: (params) => {
      if (params?.componentType !== "series") {
        return;
      }
      setHoveredSlice({
        label: params.name,
        points: Number(params.value || 0),
        percent: Number(params.percent || 0),
      });
    },
    mouseout: () => {
      setHoveredSlice(null);
    },
  };

  return (
    <div className="grid h-[calc(100dvh-10.8rem)] min-h-[44rem] gap-3 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col gap-3">
        <article className="p-1">
          <p className="cyber-kicker">Leaderboard</p>
          <h1 className="cyber-title mt-2 flex items-center gap-2 text-xl font-semibold text-foreground">
            <Trophy size={18} className="text-[#1f3b70]" />
            User Score Rankings
          </h1>
          <p className="cyber-muted mt-2 text-sm">
            Points are accumulated from scored assistant responses across all
            sessions.
          </p>
          <p className="cyber-muted mt-1 text-sm">
            Pie chart uses top 10 users plus one combined Others slice.
          </p>
        </article>

        <article className="flex h-[31.5rem] min-h-0 flex-col p-1">
          <div className="h-[25.8rem] min-h-0">
            {view === "stats" ? (
              <div className="grid h-full auto-rows-fr grid-cols-2 gap-3">
                <Stat
                  label="Total users"
                  value={Number(
                    snapshot.totalParticipants || 0,
                  ).toLocaleString()}
                  icon={<Users size={16} />}
                />
                <Stat
                  label="Your rank"
                  value={viewerRank ? `#${viewerRank}` : "—"}
                  icon={<Medal size={16} />}
                />
                <Stat
                  label="Your points"
                  value={viewerPoints.toLocaleString()}
                  icon={<Star size={16} />}
                />
                <Stat
                  label="Top points"
                  value={Number(topEntry?.points || 0).toLocaleString()}
                  icon={<Trophy size={16} />}
                />
              </div>
            ) : (
              <div className="flex h-full min-h-0 flex-col">
                {segments.length ? (
                  <>
                    <div className="mx-auto h-[244px] w-[244px]">
                      <ReactECharts
                        option={pieOption}
                        notMerge
                        lazyUpdate
                        onEvents={pieEvents}
                        opts={{ renderer: "svg" }}
                        style={{ height: "100%", width: "100%" }}
                      />
                    </div>
                    <p className="cyber-muted mt-1 min-h-10 text-xs">
                      {pieHoverText}
                    </p>
                    <div className="cyber-scroll mt-2 min-h-0 flex-1 overflow-y-auto pr-1 text-xs">
                      <ul className="space-y-1">
                        {segments.map((segment) => (
                          <li
                            key={`legend-${segment.id}`}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-foreground">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: segment.color }}
                              />
                              <span className="truncate">{segment.label}</span>
                            </span>
                            <span className="shrink-0 cyber-muted">
                              {segment.points.toLocaleString()} (
                              {segment.percent.toFixed(1)}%)
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="cyber-muted mt-1 text-[11px]">
                      Total charted points: {total.toLocaleString()}
                    </p>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="cyber-muted text-sm">No scored users yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-[rgba(21,40,82,0.22)]">
            <div className="grid grid-cols-2">
              <button
                type="button"
                className={`flex min-h-10 items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] ${view === "stats" ? "bg-[rgba(42,76,138,0.16)] text-[#152852]" : "bg-transparent text-[rgba(61,72,82,0.9)]"}`}
                onClick={() => setView("stats")}
              >
                <BarChart3 size={12} />
                Stats
              </button>
              <button
                type="button"
                className={`flex min-h-10 items-center justify-center gap-1.5 border-l border-[rgba(21,40,82,0.22)] text-xs font-semibold uppercase tracking-[0.08em] ${view === "pie" ? "bg-[rgba(42,76,138,0.16)] text-[#152852]" : "bg-transparent text-[rgba(61,72,82,0.9)]"}`}
                onClick={() => setView("pie")}
              >
                <PieChart size={12} />
                Pie chart
              </button>
            </div>
          </div>
        </article>
      </div>

      <article className="min-h-0 p-0">
        <div className="cyber-scroll h-full overflow-auto rounded-[24px] border border-[rgba(61,72,82,0.12)] bg-transparent">
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
                <tr
                  key={entry.clerkUserId}
                  className={
                    entry.isCurrentUser
                      ? "bg-[rgba(42,76,138,0.08)]"
                      : undefined
                  }
                >
                  <td className="font-medium">
                    {entry.rank <= 3 ? (
                      <span className="inline-flex items-center gap-1">
                        <Medal size={12} className="text-[#1f3b70]" />#
                        {entry.rank}
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
                  <td
                    colSpan={3}
                    className="px-4 py-6 text-center text-sm cyber-muted"
                  >
                    No leaderboard data yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div className="rounded-xl border border-[rgba(21,40,82,0.2)] p-4">
      <p className="cyber-kicker text-[11px]">{label}</p>
      <p className="cyber-title mt-2 flex items-center gap-2 text-[1.15rem] font-semibold text-foreground">
        <span className="text-[#1f3b70]">{icon}</span>
        {value}
      </p>
    </div>
  );
}
