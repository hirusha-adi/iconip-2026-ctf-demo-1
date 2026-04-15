const allowedDevOrigins = [];

if (process.env.APP_BASE_URL) {
  try {
    const { hostname } = new URL(process.env.APP_BASE_URL);
    if (hostname) {
      allowedDevOrigins.push(hostname);
    }
  } catch {
    // Ignore invalid APP_BASE_URL; env validation handles this at runtime.
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins,
};

export default nextConfig;
