import "server-only";

import { Resend } from "resend";

import { APP_BASE_URL, env } from "@/lib/server/env";

let resend;

function getResend() {
  if (!resend) {
    resend = new Resend(env.RESEND_API_KEY);
  }

  return resend;
}

export async function sendVerificationEmail({ email, token }) {
  const verifyUrl = `${APP_BASE_URL}/api/auth/verify-email?token=${token}`;

  const payload = {
    from: env.RESEND_FROM_EMAIL,
    to: email,
    subject: "Verify your ICONIP 2026 CTF account",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Verify your account</h2>
        <p>Click the link below to verify your account:</p>
        <p><a href="${verifyUrl}">Verify account</a></p>
        <p>This link expires in 24 hours.</p>
      </div>
    `,
    text: `Verify your account by visiting: ${verifyUrl}`,
  };

  console.log("[email] sending", {
    to: payload.to,
    from: payload.from,
    subject: payload.subject,
  });

  try {
    const result = await getResend().emails.send(payload);

    console.log("[email] sent", {
      to: payload.to,
      subject: payload.subject,
      id: result?.data?.id ?? null,
      error: result?.error ?? null,
    });

    if (result?.error) {
      throw new Error(result.error.message || "Email provider returned an error");
    }
  } catch (error) {
    console.error("[email] failed", {
      to: payload.to,
      subject: payload.subject,
      error: error?.message || error,
    });
    throw error;
  }
}
