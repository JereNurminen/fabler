import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // .tsx included so component and hook tests are picked up, not just .ts
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    environment: "jsdom",
  },
});
