import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        site: resolve(import.meta.dirname, "index.html"),
        painel: resolve(import.meta.dirname, "painel.html"),
      },
    },
  },
});
