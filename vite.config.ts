import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // heic2any (~1,3 MB) é carregado sob demanda, só para pré-visualizar fotos HEIC.
  build: { target: "es2020", sourcemap: false, chunkSizeWarningLimit: 1500 },
});
