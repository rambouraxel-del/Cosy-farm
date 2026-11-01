import { defineConfig } from "vite";

// base relative : fonctionne sur GitHub Pages (sous-dossier) comme en local.
export default defineConfig({
  base: "./",
  build: { outDir: "dist", target: "es2020", chunkSizeWarningLimit: 900 },
});
