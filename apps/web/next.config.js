/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@clipdesk/types'],
}
module.exports = nextConfig
