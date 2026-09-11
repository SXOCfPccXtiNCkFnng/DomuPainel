/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Evita o aviso de "workspace root" ambíguo quando há outro lockfile
  // (ex.: de outro projeto) em uma pasta acima desta no disco do dev.
  outputFileTracingRoot: process.cwd(),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async headers() {
    // 'unsafe-eval' só é necessário em desenvolvimento (Fast Refresh/HMR do
    // webpack). Em produção o Next não precisa disso — mantê-lo lá enfraquece
    // a CSP contra XSS sem ganho nenhum.
    const isDev = process.env.NODE_ENV !== 'production';
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net"
      : "script-src 'self' 'unsafe-inline' https://connect.facebook.net";

    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      scriptSrc,
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.asaas.com https://api-sandbox.asaas.com https://graph.facebook.com https://api.resend.com https://connect.facebook.net https://*.facebook.com",
      "frame-src 'self' https://*.facebook.com",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
