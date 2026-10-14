import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { GET as getMatches } from './api/matches.ts'

// Serves the Vercel function in /api during `vite dev`, so the app works locally too.
function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api/matches', async (_req, res) => {
        const response = await getMatches()
        res.statusCode = response.status
        response.headers.forEach((value, key) => res.setHeader(key, value))
        res.end(await response.text())
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devApi()],
})
