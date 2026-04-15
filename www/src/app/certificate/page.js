import Link from "next/link";
import { ArrowLeft, Download, MessageSquare } from "lucide-react";

import AppHeader from "@/components/AppHeader";
import { requirePageUser } from "@/lib/server/authz";
import { getUserPersuasionPoints } from "@/lib/server/db";

const MIN_POINTS_TO_UNLOCK = 5;

function getDisplayName(profile) {
  const firstName = String(profile?.first_name || "").trim();
  const lastName = String(profile?.last_name || "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (fullName) {
    return fullName;
  }

  return String(profile?.email || "Participant").trim();
}

export default async function CertificatePage() {
  const { userId, profile } = await requirePageUser();
  const userPoints = await getUserPersuasionPoints(userId);
  const canGenerateCertificate = Number(userPoints || 0) > MIN_POINTS_TO_UNLOCK;
  const displayName = getDisplayName(profile);

  return (
    <main className="flex flex-1">
      <div className="cyber-page-shell">
        <AppHeader profile={profile} active="user" title="Certificate" />

        <section className="cyber-page-content !mt-8">
          {canGenerateCertificate ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <h1 className="cyber-title text-3xl font-semibold text-foreground">
                    Certificate of Participation
                  </h1>
                  <p className="cyber-muted mt-2 text-sm">
                    Generated for {displayName}. Preview and download your certificate below.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Link className="cyber-btn cyber-btn-chat" href="/user">
                    <ArrowLeft size={16} />
                    Back
                  </Link>
                  <a className="cyber-btn cyber-btn-solid" href="/api/certificate?download=1">
                    <Download size={16} />
                    Download
                  </a>
                </div>
              </div>

              <div className="overflow-hidden rounded-[2rem] border border-[rgba(61,72,82,0.2)] bg-[#f4f4f4] shadow-[0_14px_34px_rgba(20,40,82,0.12)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/api/certificate"
                  alt={`Certificate preview for ${displayName}`}
                  className="block h-auto w-full object-contain"
                />
              </div>
            </div>
          ) : (
            <div className="flex min-h-[52vh] items-center justify-center">
              <div className="max-w-2xl text-center">
                <p className="cyber-kicker">Certificate Locked</p>
                <h1 className="cyber-title mt-2 text-2xl font-semibold text-foreground">
                  You need to try to convince the AI more and come back later again.
                </h1>
                <p className="cyber-muted mt-3 text-sm">
                  You currently have {Number(userPoints || 0).toLocaleString()} points. Earn more than{" "}
                  {MIN_POINTS_TO_UNLOCK} points to unlock certificate generation.
                </p>
                <p className="mt-5">
                  <Link className="cyber-btn cyber-btn-solid" href="/chat">
                    <MessageSquare size={16} />
                    Continue challenge
                  </Link>
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
