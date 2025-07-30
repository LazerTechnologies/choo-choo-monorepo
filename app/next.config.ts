import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['imagescript', 'generator'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('generator');
      config.externals.push('imagescript');
    }

    // Ignore .node files for both server and client
    config.module.rules.push({
      test: /\.node$/,
      use: 'ignore-loader',
    });

    return config;
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
