import type { NextConfig } from 'next'
import path from 'node:path'
import CopyWebpackPlugin from 'copy-webpack-plugin'

type ExtendedNextConfig = NextConfig & {
	outputFileTracingIncludes?: Record<string, string[]>
}

const nextConfig: ExtendedNextConfig = {
	outputFileTracingIncludes: {
		'/api/checklists/[id]/email': ['node_modules/pdfkit/js/data/**/*']
	},
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: '*.supabase.co'
			},
			{
				protocol: 'https',
				hostname: '*.supabase.in'
			}
		]
	},
	webpack: (config, { isServer }) => {
		if (isServer) {
			const dataSource = path.join(process.cwd(), 'node_modules/pdfkit/js/data')
			const destinations = new Set<string>([
				path.join(process.cwd(), '.next/server/vendor-chunks/data'),
				path.join(process.cwd(), '.next/server/chunks/data')
			])

			const apiRouteStandardDestinations = [
				// PDFKit resolves bundled standard fonts relative to the API route directory in production.
				path.join(process.cwd(), '.next/server/app/api/checklists/[id]/email/standard')
			]
			apiRouteStandardDestinations.forEach(destination => destinations.add(destination))

			const outputPath = config.output?.path
			if (outputPath) {
				destinations.add(path.join(outputPath, 'vendor-chunks/data'))
				destinations.add(path.join(outputPath, '../vendor-chunks/data'))
				destinations.add(path.join(outputPath, 'chunks/data'))
				destinations.add(path.join(outputPath, '../chunks/data'))
				destinations.add(path.resolve(outputPath, 'api/checklists/[id]/email/standard'))
			}

			const patterns = Array.from(destinations).map(destination => ({
				from: dataSource,
				to: destination,
				noErrorOnMissing: true
			}))

			if (patterns.length > 0) {
				config.plugins = config.plugins ?? []
				config.plugins.push(new CopyWebpackPlugin({ patterns }))
			}
		}

		return config
	}
}

export default nextConfig
