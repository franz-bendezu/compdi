import { defineConfig } from "vite";
import { vitePlugin } from "compdi/plugin";

export default defineConfig({
  plugins: [vitePlugin()],
  build: {
    target: "esnext"
  }
});
