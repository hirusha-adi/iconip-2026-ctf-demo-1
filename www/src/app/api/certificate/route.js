import { auth } from "@clerk/nextjs/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { getProfileByClerkId, getUserPersuasionPoints } from "@/lib/server/db";

const MIN_POINTS_TO_UNLOCK = 5;
const CERTIFICATE_WIDTH = 1600;
const CERTIFICATE_HEIGHT = 1131;

let cachedLogos = null;

function escapeXml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function getDisplayName(profile) {
  const firstName = String(profile?.first_name || "").trim();
  const lastName = String(profile?.last_name || "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (fullName) {
    return fullName;
  }

  return String(profile?.email || "Participant").trim();
}

function getCertificateId(userId) {
  const safeUserId = String(userId || "user").replace(/[^a-zA-Z0-9]/g, "").slice(-12) || "USER";
  const date = new Date();
  const isoDate = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  return `ICONIP-CTF-${isoDate}-${safeUserId.toUpperCase()}`;
}

async function getLogoDataUris() {
  if (cachedLogos) {
    return cachedLogos;
  }

  const bluePath = path.join(process.cwd(), "public", "logo_blue.png");
  const whitePath = path.join(process.cwd(), "public", "logo_white.png");

  const [blueBuffer, whiteBuffer] = await Promise.all([
    readFile(bluePath),
    readFile(whitePath),
  ]);

  cachedLogos = {
    blue: `data:image/png;base64,${blueBuffer.toString("base64")}`,
    white: `data:image/png;base64,${whiteBuffer.toString("base64")}`,
  };

  return cachedLogos;
}

function buildCertificateSvg({ fullName, points, certificateId, logoBlue, logoWhite }) {
  const issueDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const escapedName = escapeXml(fullName);
  const escapedCertId = escapeXml(certificateId);
  const escapedIssueDate = escapeXml(issueDate);
  const escapedPoints = escapeXml(points.toLocaleString());

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CERTIFICATE_WIDTH}" height="${CERTIFICATE_HEIGHT}" viewBox="0 0 ${CERTIFICATE_WIDTH} ${CERTIFICATE_HEIGHT}">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f3f6fb"/>
      <stop offset="100%" stop-color="#e0e7f3"/>
    </linearGradient>
    <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#152852"/>
      <stop offset="100%" stop-color="#2a4c8a"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-opacity="0.12"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${CERTIFICATE_WIDTH}" height="${CERTIFICATE_HEIGHT}" fill="url(#bgGradient)" />
  <rect x="42" y="42" width="${CERTIFICATE_WIDTH - 84}" height="${CERTIFICATE_HEIGHT - 84}" rx="34" fill="#f9fbff" stroke="#d5ddea" stroke-width="3" filter="url(#softShadow)" />
  <rect x="72" y="72" width="${CERTIFICATE_WIDTH - 144}" height="148" rx="24" fill="url(#accentGradient)" />

  <image href="${logoWhite}" x="98" y="88" width="115" height="115" preserveAspectRatio="xMidYMid meet" />
  <image href="${logoBlue}" x="${CERTIFICATE_WIDTH - 248}" y="86" width="120" height="120" preserveAspectRatio="xMidYMid meet" />

  <text x="${CERTIFICATE_WIDTH / 2}" y="160" text-anchor="middle" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="56" font-weight="800" fill="#f4f8ff">ICONIP 2026 CTF</text>
  <text x="${CERTIFICATE_WIDTH / 2}" y="205" text-anchor="middle" font-family="'DM Sans', Arial, sans-serif" font-size="24" font-weight="600" fill="#dce8ff" letter-spacing="5">CERTIFICATE OF PARTICIPATION</text>

  <text x="${CERTIFICATE_WIDTH / 2}" y="330" text-anchor="middle" font-family="'DM Sans', Arial, sans-serif" font-size="34" font-weight="500" fill="#2f3d56">This certifies that</text>
  <text x="${CERTIFICATE_WIDTH / 2}" y="455" text-anchor="middle" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="92" font-weight="800" fill="#152852">${escapedName}</text>
  <line x1="250" y1="490" x2="${CERTIFICATE_WIDTH - 250}" y2="490" stroke="#9caecb" stroke-width="2.8" />

  <text x="${CERTIFICATE_WIDTH / 2}" y="575" text-anchor="middle" font-family="'DM Sans', Arial, sans-serif" font-size="32" fill="#3d4852">
    has successfully participated in the AI Misinformation Resilience Challenge
  </text>

  <rect x="330" y="650" width="${CERTIFICATE_WIDTH - 660}" height="140" rx="18" fill="#edf2fb" stroke="#c7d3e8" stroke-width="2" />
  <text x="${CERTIFICATE_WIDTH / 2}" y="718" text-anchor="middle" font-family="'DM Sans', Arial, sans-serif" font-size="32" font-weight="700" fill="#1f3b70">
    Challenge Score: ${escapedPoints} points
  </text>
  <text x="${CERTIFICATE_WIDTH / 2}" y="760" text-anchor="middle" font-family="'DM Sans', Arial, sans-serif" font-size="22" fill="#4b5d7b">
    Awarded after exceeding 5 persuasion points in the challenge.
  </text>

  <line x1="190" y1="900" x2="590" y2="900" stroke="#aebbd1" stroke-width="2" />
  <text x="390" y="940" text-anchor="middle" font-family="'DM Sans', Arial, sans-serif" font-size="22" fill="#4b5d7b">Issued: ${escapedIssueDate}</text>

  <line x1="${CERTIFICATE_WIDTH - 590}" y1="900" x2="${CERTIFICATE_WIDTH - 190}" y2="900" stroke="#aebbd1" stroke-width="2" />
  <text x="${CERTIFICATE_WIDTH - 390}" y="940" text-anchor="middle" font-family="'DM Sans', Arial, sans-serif" font-size="22" fill="#4b5d7b">Certificate ID: ${escapedCertId}</text>

  <text x="${CERTIFICATE_WIDTH / 2}" y="${CERTIFICATE_HEIGHT - 86}" text-anchor="middle" font-family="'DM Sans', Arial, sans-serif" font-size="18" fill="#6b7280">
    ICONIP 2026 • AI Misinformation Resilience Challenge
  </text>
</svg>`;
}

export async function GET(request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [profile, points] = await Promise.all([
    getProfileByClerkId(userId),
    getUserPersuasionPoints(userId),
  ]);

  if (Number(points || 0) <= MIN_POINTS_TO_UNLOCK) {
    return NextResponse.json(
      { error: "Certificate locked", message: "You need to score more than 5 points." },
      { status: 403 },
    );
  }

  const { blue, white } = await getLogoDataUris();
  const fullName = getDisplayName(profile);
  const certificateId = getCertificateId(userId);
  const svg = buildCertificateSvg({
    fullName,
    points: Number(points || 0),
    certificateId,
    logoBlue: blue,
    logoWhite: white,
  });

  const shouldDownload =
    new URL(request.url).searchParams.get("download") === "1";

  const headers = new Headers({
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "private, no-store",
  });

  if (shouldDownload) {
    const safeFileName = fullName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "participant";
    headers.set(
      "Content-Disposition",
      `attachment; filename="iconip-ctf-certificate-${safeFileName}.svg"`,
    );
  }

  return new NextResponse(svg, { status: 200, headers });
}

