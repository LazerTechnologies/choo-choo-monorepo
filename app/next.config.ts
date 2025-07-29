import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable transpilation of workspace packages
  transpilePackages: ['generator'],
  
  // Webpack configuration for monorepo
  webpack: (config, { isServer }) => {
    // Allow importing from workspace packages
    config.externals = config.externals || [];
    
    if (isServer) {
      // Don't externalize workspace packages on server
      config.externals = config.externals.filter(
        (external: any) => typeof external !== 'string' || !external.includes('generator')
      );
    }
    
    return config;
  },
};

export default nextConfig;
