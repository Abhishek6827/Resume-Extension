import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, "src/sidepanel/index.html"),
        popup: resolve(__dirname, "src/popup/index.html"),
        "service-worker": resolve(__dirname, "src/background/service-worker.ts"),
        detector: resolve(__dirname, "src/content/detector.ts"),
        selector: resolve(__dirname, "src/content/selector.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Keep background and content scripts at the root level without hash,
          // matching manifest.json expected paths.
          if (
            chunkInfo.name === "service-worker" ||
            chunkInfo.name === "detector" ||
            chunkInfo.name === "selector"
          ) {
            return "[name].js";
          }
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
