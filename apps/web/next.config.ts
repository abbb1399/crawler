import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Every page reads live data from the API; plain dynamic rendering is simpler
  // than Cache Components' Suspense requirements for a local dashboard.
  cacheComponents: false,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
