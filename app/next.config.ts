import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
  images: {
    unoptimized: true, // Helpful for Docker deployments
  },
};

export default nextConfig;
