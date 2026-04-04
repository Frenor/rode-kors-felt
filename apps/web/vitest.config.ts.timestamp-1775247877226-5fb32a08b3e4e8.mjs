// vitest.config.ts
import { defineConfig } from "file:///Users/fredrik/.codex/worktrees/88b4/rode-kors-felt/node_modules/.pnpm/vitest@2.1.9_@types+node@25.5.0_jsdom@29.0.1_terser@5.46.1/node_modules/vitest/dist/config.js";
import react from "file:///Users/fredrik/.codex/worktrees/88b4/rode-kors-felt/node_modules/.pnpm/@vitejs+plugin-react-swc@4.3.0_vite@6.4.1_@types+node@25.5.0_jiti@2.6.1_terser@5.46.1_tsx@4.21.0_yaml@2.8.3_/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "node:path";
var __vite_injected_original_dirname = "/Users/fredrik/.codex/worktrees/88b4/rode-kors-felt/apps/web";
var vitest_config_default = defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    exclude: ["**/node_modules/**", "**/e2e/**"]
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  }
});
export {
  vitest_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZXN0LmNvbmZpZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9Vc2Vycy9mcmVkcmlrLy5jb2RleC93b3JrdHJlZXMvODhiNC9yb2RlLWtvcnMtZmVsdC9hcHBzL3dlYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL2ZyZWRyaWsvLmNvZGV4L3dvcmt0cmVlcy84OGI0L3JvZGUta29ycy1mZWx0L2FwcHMvd2ViL3ZpdGVzdC5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2ZyZWRyaWsvLmNvZGV4L3dvcmt0cmVlcy84OGI0L3JvZGUta29ycy1mZWx0L2FwcHMvd2ViL3ZpdGVzdC5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlc3QvY29uZmlnJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2MnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCldLFxuICB0ZXN0OiB7XG4gICAgZ2xvYmFsczogdHJ1ZSxcbiAgICBlbnZpcm9ubWVudDogJ2pzZG9tJyxcbiAgICBzZXR1cEZpbGVzOiBbJy4vc3JjL19fdGVzdHNfXy9zZXR1cC50cyddLFxuICAgIGV4Y2x1ZGU6IFsnKiovbm9kZV9tb2R1bGVzLyoqJywgJyoqL2UyZS8qKiddLFxuICB9LFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICdAJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXG4gICAgfSxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUEwVyxTQUFTLG9CQUFvQjtBQUN2WSxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBRmpCLElBQU0sbUNBQW1DO0FBSXpDLElBQU8sd0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUNqQixNQUFNO0FBQUEsSUFDSixTQUFTO0FBQUEsSUFDVCxhQUFhO0FBQUEsSUFDYixZQUFZLENBQUMsMEJBQTBCO0FBQUEsSUFDdkMsU0FBUyxDQUFDLHNCQUFzQixXQUFXO0FBQUEsRUFDN0M7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUN0QztBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
