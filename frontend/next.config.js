/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  // Turbopack config - empty to silence warnings
  turbopack: {},
};

module.exports = nextConfig;
