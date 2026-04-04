/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server Actions are stable in Next.js 14 — no experimental flag needed

  // Allows the admin app to load images from the backend storage bucket
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.akripesa.com',
        pathname: '/lpos/**',
      },
    ],
  },

  // Proxy /api/* calls to the Node.js backend during development
  // so Server Actions and fetch() calls use a consistent base URL
  async rewrites() {
    return [
      {
        source:      '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;