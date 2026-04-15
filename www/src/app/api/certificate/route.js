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
  const safeUserId =
    String(userId || "user")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(-12) || "USER";
  const date = new Date();
  const isoDate = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  return `ICONIP-CTF-${isoDate}-${safeUserId.toUpperCase()}`;
}

async function getLogoDataUris() {
  if (cachedLogos) {
    return cachedLogos;
  }

  const bluePath = path.join(process.cwd(), "public", "logo_blue.png");
  const blueBuffer = await readFile(bluePath);

  cachedLogos = {
    blue: `data:image/png;base64,${blueBuffer.toString("base64")}`,
  };

  return cachedLogos;
}

function buildCertificateSvg({ fullName, points, certificateId, logoBlue }) {
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
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#1c2a44" flood-opacity="0.12"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${CERTIFICATE_WIDTH}" height="${CERTIFICATE_HEIGHT}" fill="#f4f4f4" />

  <rect x="30" y="30" width="${CERTIFICATE_WIDTH - 60}" height="${CERTIFICATE_HEIGHT - 60}" rx="14" fill="none" stroke="#c1a05c" stroke-width="5"/>
  <rect x="55" y="55" width="${CERTIFICATE_WIDTH - 110}" height="${CERTIFICATE_HEIGHT - 110}" rx="12" fill="none" stroke="#cfb57a" stroke-width="2"/>

  <path d="M34 34 L47 34 L34 47 Z" fill="#c1a05c"/>
  <path d="M${CERTIFICATE_WIDTH - 34} 34 L${CERTIFICATE_WIDTH - 47} 34 L${CERTIFICATE_WIDTH - 34} 47 Z" fill="#c1a05c"/>
  <path d="M34 ${CERTIFICATE_HEIGHT - 34} L47 ${CERTIFICATE_HEIGHT - 34} L34 ${CERTIFICATE_HEIGHT - 47} Z" fill="#c1a05c"/>
  <path d="M${CERTIFICATE_WIDTH - 34} ${CERTIFICATE_HEIGHT - 34} L${CERTIFICATE_WIDTH - 47} ${CERTIFICATE_HEIGHT - 34} L${CERTIFICATE_WIDTH - 34} ${CERTIFICATE_HEIGHT - 47} Z" fill="#c1a05c"/>

  <image href="${logoBlue}" x="${CERTIFICATE_WIDTH / 2 - 110}" y="90" width="220" height="220" preserveAspectRatio="xMidYMid meet"/>

  <line x1="500" y1="295" x2="${CERTIFICATE_WIDTH - 500}" y2="295" stroke="#c3a769" stroke-width="2"/>
  <text x="${CERTIFICATE_WIDTH / 2}" y="352" text-anchor="middle" font-family="'Times New Roman', Georgia, serif" font-size="44" fill="#123f74" letter-spacing="1.5">CERTIFICATE OF</text>
  <text x="${CERTIFICATE_WIDTH / 2}" y="454" text-anchor="middle" font-family="'Times New Roman', Georgia, serif" font-size="74" font-weight="700" fill="#113b69" letter-spacing="1.8">PARTICIPATION</text>
  <line x1="600" y1="490" x2="${CERTIFICATE_WIDTH - 600}" y2="490" stroke="#c3a769" stroke-width="2"/>

  <text x="${CERTIFICATE_WIDTH / 2}" y="575" text-anchor="middle" font-family="'Times New Roman', Georgia, serif" font-style="italic" font-size="38" fill="#2c4f7d">
    This certificate is proudly presented to
  </text>

  <text x="${CERTIFICATE_WIDTH / 2}" y="655" text-anchor="middle" font-family="'Times New Roman', Georgia, serif" font-size="62" font-weight="600" fill="#a8b5c3">
    ${escapedName}
  </text>

  <line x1="235" y1="705" x2="${CERTIFICATE_WIDTH - 235}" y2="705" stroke="#c3a769" stroke-width="2"/>

  <text x="${CERTIFICATE_WIDTH / 2}" y="780" text-anchor="middle" font-family="'Times New Roman', Georgia, serif" font-size="34" fill="#233f66">
    for their participation in the
  </text>
  <text x="${CERTIFICATE_WIDTH / 2}" y="844" text-anchor="middle" font-family="'Times New Roman', Georgia, serif" font-size="46" font-weight="700" fill="#0f3c6c">
    ICONIP 2026 — AI Safety Capture The Flag (CTF) Competition
  </text>
  <text x="${CERTIFICATE_WIDTH / 2}" y="895" text-anchor="middle" font-family="'Times New Roman', Georgia, serif" font-size="27" fill="#2f4f7a">
    33rd International Conference on Neural Information Processing • November 23–27, 2026 • Melbourne, Australia
  </text>

  <line x1="635" y1="980" x2="${CERTIFICATE_WIDTH - 635}" y2="980" stroke="#3f4a5f" stroke-width="2.6"/>
  <text x="${CERTIFICATE_WIDTH / 2}" y="970" text-anchor="middle" font-family="'Times New Roman', Georgia, serif" font-size="40" font-weight="700" fill="#122e55">Asim Bhatti</text>
  <text x="${CERTIFICATE_WIDTH / 2}" y="1020" text-anchor="middle" font-family="'Times New Roman', Georgia, serif" font-size="30" font-style="italic" fill="#2f4f7a">CTF Organiser, ICONIP 2026</text>

  <line x1="660" y1="${CERTIFICATE_HEIGHT - 76}" x2="790" y2="${CERTIFICATE_HEIGHT - 76}" stroke="#c3a769" stroke-width="2"/>
  <rect x="795" y="${CERTIFICATE_HEIGHT - 73}" width="14" height="14" transform="rotate(45 802  ${CERTIFICATE_HEIGHT - 56})" fill="#c3a769"/>
  <line x1="815" y1="${CERTIFICATE_HEIGHT - 76}" x2="945" y2="${CERTIFICATE_HEIGHT - 76}" stroke="#c3a769" stroke-width="2"/>

  <text x="${CERTIFICATE_WIDTH - 66}" y="${CERTIFICATE_HEIGHT - 22}" text-anchor="end" font-family="'DM Sans', Arial, sans-serif" font-size="11" fill="#7f8da1">
    ${escapedIssueDate} • ${escapedCertId} • ${escapedPoints} points
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
      {
        error: "Certificate locked",
        message: "You need to score more than 5 points.",
      },
      { status: 403 },
    );
  }

  const { blue } = await getLogoDataUris();
  const fullName = getDisplayName(profile);
  const certificateId = getCertificateId(userId);
  const svg = buildCertificateSvg({
    fullName,
    points: Number(points || 0),
    certificateId,
    logoBlue: blue,
  });

  const shouldDownload =
    new URL(request.url).searchParams.get("download") === "1";

  const headers = new Headers({
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "private, no-store",
  });

  if (shouldDownload) {
    const safeFileName =
      fullName
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
