import { defineConfig } from 'vite'
import iguir from '@iguir/core/vite-plugin'

export default defineConfig({
    plugins: [iguir()],
    // The Iguir server (Hono on Bun) runs separately. Vite handles the
    // client-side bundle for islands + page virtual modules.
    server: {
        port: 5173,
    },
})
