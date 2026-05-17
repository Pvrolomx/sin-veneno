/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Allow Web Workers in Next.js
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.worker\.ts$/,
      use: { loader: 'worker-loader', options: { esModule: true } },
    });
    return config;
  },
};

module.exports = nextConfig;
