import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Client-side router cache: pages visited in the last 30s render instantly
  // from cache when navigated back to instead of a full server round trip.
  // Saves/deletes still show fresh data — they call revalidatePath +
  // router.refresh(), which invalidate this cache.
  experimental: {
    staleTimes: { dynamic: 30 }
  },
  // Keep pdfkit out of the webpack bundle so it loads from node_modules at
  // runtime. Its standard-font metrics are served from an embedded constant
  // (see the email route), so no font files need to be traced into the bundle.
  serverExternalPackages: ['pdfkit'],
  // Ensure the company logo ships inside the email serverless function on
  // Vercel (public/ assets are CDN-served and otherwise absent from the
  // function filesystem), so the PDF header logo renders in production.
  outputFileTracingIncludes: {
    '/api/checklists/[id]/email': ['./public/logo.png'],
    '/api/checklists/[id]/pdf': ['./public/logo.png']
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' }
    ]
  }
}

export default nextConfig
