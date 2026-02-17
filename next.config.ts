import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  trailingSlash: false,
  async redirects() {
    return [
      {
        source: '/investigations',
        destination: '/essays',
        permanent: true,
      },
      {
        source: '/investigations/:slug',
        destination: '/essays/:slug',
        permanent: true,
      },
      {
        source: '/working-ideas',
        destination: '/field-notes',
        permanent: true,
      },
      {
        source: '/working-ideas/:slug',
        destination: '/field-notes/:slug',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
