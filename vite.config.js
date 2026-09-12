import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // ── ONNX Runtime Web ────────────────────────────────────────────────────
  // onnxruntime-web ships WASM binaries that must not be bundled by Vite's
  // dep optimizer. Excluding it ensures the WASM files are served as static
  // assets and loaded correctly at runtime by the library itself.
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },

  // Treat .onnx model files as static assets so they get a content-hash
  // filename and are served from the public/ or assets/ directory.
  assetsInclude: ['**/*.onnx'],
})
