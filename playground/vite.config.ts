import { defineConfig } from "vite";
import compdi from "unplugin-compdi/vite";

export default defineConfig({
  plugins: [compdi({}) as any],
  build: {
    target: "esnext"
  }
});
