import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Keep pdfkit out of the webpack bundle so it loads from node_modules at
  // runtime. Its standard-font metrics are served from an embedded constant
  // (see the email route), so no font files need to be traced into the bundle.
  serverExternalPackages: ['pdfkit'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' }
    ]
  }
}

export default nextConfig
