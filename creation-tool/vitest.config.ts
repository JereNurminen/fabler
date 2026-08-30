import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // .tsx included so component and hook tests are picked up, not just .ts
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    // Without this, @testing-library/react's automatic afterEach(cleanup)
    // never self-registers (it only installs when it finds a global
    // `afterEach`), so component/hook tests without an explicit
    // afterEach(cleanup) leak mounted trees into later tests.
    globals: true,
  },
});
