// tailwind.config.ts
import type { Config } from 'tailwindcss'
import forms from '@tailwindcss/forms'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}', // This single line correctly scans all files in the src directory
  ],
  plugins: [forms],
}
export default config
