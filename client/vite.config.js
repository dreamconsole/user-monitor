import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    allowedHosts: [
      'sourcecodekart.com',
      'www.sourcecodekart.com',
      'app.sourcecodekart.com',
      'api.sourcecodekart.com',
      'usermonitor-project.sourcecodekart.com',
      'usermonitor-demo.sourcecodekart.com'
    ]
  }
})
