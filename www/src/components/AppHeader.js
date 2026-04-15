"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  BookOpen,
  ChevronDown,
  Compass,
  Gift,
  LogOut,
  MessageSquare,
  Shield,
  Trophy,
  User,
} from "lucide-react";

function buttonClass(active, key, baseClass, activeClass) {
  return active === key ? `cyber-btn ${activeClass}` : `cyber-btn ${baseClass}`;
}

function groupedButtonClass(active, keys) {
  return keys.includes(active)
    ? "cyber-btn cyber-btn-solid"
    : "cyber-btn cyber-btn-secondary";
}

export default function AppHeader({
  profile,
  active = "",
  title = "Workspace",
}) {
  const firstName = profile?.first_name || "User";
  const showAdmin = Boolean(profile?.is_admin);
  const exploreRef = useRef(null);
  const accountRef = useRef(null);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (
        exploreRef.current?.open &&
        !exploreRef.current.contains(event.target)
      ) {
        exploreRef.current.open = false;
      }

      if (
        accountRef.current?.open &&
        !accountRef.current.contains(event.target)
      ) {
        accountRef.current.open = false;
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return (
    <header className="cyber-page-header">
      <div>
        <p className="cyber-page-title !text-[1.25rem]">ICONIP2026 CTF</p>
        <p className="cyber-kicker mt-1">{title}</p>
      </div>

      <nav className="cyber-page-actions" aria-label="Account navigation">
        <Link
          className={buttonClass(
            active,
            "chat",
            "cyber-btn-chat",
            "cyber-btn-chat-active",
          )}
          href="/chat"
        >
          <MessageSquare size={16} />
          Chat
        </Link>

        <details
          ref={exploreRef}
          className="group relative"
          onToggle={() => {
            if (exploreRef.current?.open && accountRef.current) {
              accountRef.current.open = false;
            }
          }}
        >
          <summary
            className={`${groupedButtonClass(active, ["leaderboards", "guide", "prizes"])} list-none [&::-webkit-details-marker]:hidden`}
          >
            <Compass size={16} />
            Explore
            <ChevronDown
              size={14}
              className="transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-[rgba(21,40,82,0.2)] bg-[var(--surface-elevated)] p-1 shadow-[0_12px_22px_rgba(20,40,82,0.14)]">
            <Link
              className={`cyber-btn w-full justify-start ${active === "leaderboards" ? "cyber-btn-solid" : "cyber-btn-outline"}`}
              href="/leaderboards"
            >
              <Trophy size={15} />
              Leaderboards
            </Link>
            <Link
              className={`cyber-btn mt-1 w-full justify-start ${active === "guide" ? "cyber-btn-solid" : "cyber-btn-outline"}`}
              href="/guide"
            >
              <BookOpen size={15} />
              Guide
            </Link>
            <Link
              className={`cyber-btn mt-1 w-full justify-start ${active === "prizes" ? "cyber-btn-solid" : "cyber-btn-outline"}`}
              href="/prizes"
            >
              <Gift size={15} />
              Prizes
            </Link>
          </div>
        </details>

        <details
          ref={accountRef}
          className="group relative"
          onToggle={() => {
            if (accountRef.current?.open && exploreRef.current) {
              exploreRef.current.open = false;
            }
          }}
        >
          <summary
            className={`${groupedButtonClass(active, ["user", "admin"])} list-none [&::-webkit-details-marker]:hidden`}
          >
            <User size={16} />
            {`Account (${firstName})`}
            <ChevronDown
              size={14}
              className="transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-[rgba(21,40,82,0.2)] bg-[var(--surface-elevated)] p-1 shadow-[0_12px_22px_rgba(20,40,82,0.14)]">
            <Link
              className={`cyber-btn w-full justify-start ${active === "user" ? "cyber-btn-user-active" : "cyber-btn-user"}`}
              href="/user"
            >
              <User size={15} />
              Settings
            </Link>
            {showAdmin ? (
              <Link
                className={`cyber-btn mt-1 w-full justify-start ${active === "admin" ? "cyber-btn-admin-active" : "cyber-btn-admin"}`}
                href="/admin/users/"
              >
                <Shield size={15} />
                Admin
              </Link>
            ) : null}
            <Link
              className="cyber-btn cyber-btn-danger mt-1 w-full justify-start"
              href="/logout"
            >
              <LogOut size={15} />
              Logout
            </Link>
          </div>
        </details>
      </nav>
    </header>
  );
}
