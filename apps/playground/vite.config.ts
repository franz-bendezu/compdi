import { defineConfig } from "vite";
import vitePlugin from "compdi/plugin/vite";

export default defineConfig({
  plugins: [vitePlugin()],
  build: {
    target: "esnext"
  }
});
