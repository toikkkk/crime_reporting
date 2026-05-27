/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  devIndicators: false,
  experimental: {},
  turbopack: {
    root: __dirname,
  },
}

module.exports = nextConfig