// Backenden körs lokalt på port 5001 under utveckling (se CLAUDE.md). Utan den
// här källan blockerar CSP:n varje anrop dit, och frontenden kan inte prata med
// en lokal backend över huvud taget – anropen misslyckas utan svar. Den läggs
// bara till i utvecklingsbygget; produktionen behåller den strikta listan.
const isDevelopment = process.env.NODE_ENV !== 'production';

const connectSrc = [
  "'self'",
  'https://tobiaslundh1.pythonanywhere.com',
  ...(isDevelopment ? ['http://localhost:5001'] : []),
].join(' ');

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  compiler: {
    removeConsole: {
      exclude: ['error', 'warn'],
    },
  },
  async headers() {
    return [
      {
        source: '/twemoji/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
        ]
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        ]
      }
    ];
  }
};

export default nextConfig;
