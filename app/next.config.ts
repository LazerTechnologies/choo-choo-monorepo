import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['imagescript'],
  },
  images: {
    unoptimized: true, // Helpful for Docker deployments
  },
};

export default nextConfig;
