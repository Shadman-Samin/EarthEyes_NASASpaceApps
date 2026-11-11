import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        test: {
          name: "frontend",
          environment: "jsdom",
          setupFiles: ["./src/test/setup.ts"],
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          css: true,
        },
      },
      {
        test: {
          name: "backend",
          environment: "node",
          include: ["backend/**/*.test.ts"],
          restoreMocks: true,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/domain/**", "src/data/**", "src/features/**", "src/routes/**", "backend/api/src/**"],
      thresholds: { lines: 55, functions: 50, branches: 45, statements: 55 },
    },
  },
})
