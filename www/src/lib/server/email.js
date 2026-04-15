import "server-only";

import nodemailer from "nodemailer";

import { APP_BASE_URL, env } from "@/lib/server/env";

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  return transporter;
}

function getFromAddress() {
  if (!env.SMTP_FROM_NAME) {
    return env.SMTP_FROM_EMAIL;
  }

  const safeName = env.SMTP_FROM_NAME.replaceAll('"', '\\"');
  return `"${safeName}" <${env.SMTP_FROM_EMAIL}>`;
}

async function sendEmail(payload) {
  console.log("[email] sending", {
    to: payload.to,
    from: payload.from,
    subject: payload.subject,
  });

  try {
    const result = await getTransporter().sendMail(payload);

    console.log("[email] sent", {
      to: payload.to,
      subject: payload.subject,
      messageId: result?.messageId ?? null,
      accepted: result?.accepted ?? [],
      rejected: result?.rejected ?? [],
      response: result?.response ?? null,
    });

    if (Array.isArray(result?.accepted) && result.accepted.length === 0) {
      throw new Error("SMTP server rejected the recipient");
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

export async function sendVerificationEmail({ email, token }) {
  const verifyUrl = `${APP_BASE_URL}/api/auth/verify-email?token=${token}`;

  const payload = {
    from: getFromAddress(),
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

  await sendEmail(payload);
}

export async function sendPasswordResetEmail({ email, token }) {
  const resetUrl = `${APP_BASE_URL}/reset-password?token=${token}`;

  const payload = {
    from: getFromAddress(),
    to: email,
    subject: "Reset your ICONIP 2026 CTF password",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Reset your password</h2>
        <p>Click the link below to choose a new password:</p>
        <p><a href="${resetUrl}">Reset password</a></p>
        <p>This link expires in 1 hour.</p>
      </div>
    `,
    text: `Reset your password by visiting: ${resetUrl}`,
  };

  await sendEmail(payload);
}
