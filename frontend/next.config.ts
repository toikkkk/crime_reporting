/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  experimental: {},
  turbopack: {
    root: __dirname,
  },
}

module.exports = nextConfig