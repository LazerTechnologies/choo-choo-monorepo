import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['imagescript'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ensure ImageScript native binaries are not bundled by Webpack
      config.externals.push({ imagescript: 'commonjs imagescript' });
    }
    return config;
  },
  images: {
    unoptimized: true, // Helpful for Docker deployments
  },
};

export default nextConfig;
