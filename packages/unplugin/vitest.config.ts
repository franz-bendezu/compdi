import { defineConfig } from "vitest/config";
import compdi from "./src/vite";

export default defineConfig({
  plugins: [compdi({ include: /(?:create-)?scoped-runtime\.test\.ts/ })]
});
