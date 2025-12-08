/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    domains: ['generativelanguage.googleapis.com'],
    unoptimized: true,
  },
}

module.exports = nextConfig
