import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

// https://astro.build
export default defineConfig({
  site: "https://takaki.ai",
  base: "/",
  integrations: [react(), tailwind()],
  vite: {
    ssr: {
      // three is ESM-only; keep it out of SSR externalization edge-cases
      noExternal: ["three"],
    },
  },
});
