/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Proxies /api/* through this same Next.js origin to the real backend
  // (NEXT_PUBLIC_API_URL). The frontend and backend are deployed on
  // different domains (Vercel + Render); without this, the session cookie
  // is a third-party cookie from the browser's point of view, which modern
  // Chrome increasingly blocks by default regardless of SameSite=None -
  // breaking login unpredictably depending on the visitor's browser
  // settings. Routing everything through one origin makes the cookie
  // first-party and sidesteps the problem entirely, in both production and
  // local dev.
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
