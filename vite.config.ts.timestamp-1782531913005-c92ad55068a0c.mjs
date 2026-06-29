// vite.config.ts
import { defineConfig } from "file:///C:/Users/USUARIO/OneDrive/Desktop/proyecto/footcarePodologia/sistemaPodologia/sole-flow-manager-main/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/USUARIO/OneDrive/Desktop/proyecto/footcarePodologia/sistemaPodologia/sole-flow-manager-main/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///C:/Users/USUARIO/OneDrive/Desktop/proyecto/footcarePodologia/sistemaPodologia/sole-flow-manager-main/node_modules/lovable-tagger/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\USUARIO\\OneDrive\\Desktop\\proyecto\\footcarePodologia\\sistemaPodologia\\sole-flow-manager-main";
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false
    },
    allowedHosts: ["anh-billowier-atlas.ngrok-free.dev"],
    proxy: {
      "/api": {
        target: "http://localhost:8080/",
        changeOrigin: true,
        secure: false
      }
    }
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"]
  },
  /** Evita "Outdated Optimize Dep" con deps añadidas o caché de Vite desincronizada */
  optimizeDeps: {
    include: ["@radix-ui/react-scroll-area"]
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxVU1VBUklPXFxcXE9uZURyaXZlXFxcXERlc2t0b3BcXFxccHJveWVjdG9cXFxcZm9vdGNhcmVQb2RvbG9naWFcXFxcc2lzdGVtYVBvZG9sb2dpYVxcXFxzb2xlLWZsb3ctbWFuYWdlci1tYWluXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxVU1VBUklPXFxcXE9uZURyaXZlXFxcXERlc2t0b3BcXFxccHJveWVjdG9cXFxcZm9vdGNhcmVQb2RvbG9naWFcXFxcc2lzdGVtYVBvZG9sb2dpYVxcXFxzb2xlLWZsb3ctbWFuYWdlci1tYWluXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9VU1VBUklPL09uZURyaXZlL0Rlc2t0b3AvcHJveWVjdG8vZm9vdGNhcmVQb2RvbG9naWEvc2lzdGVtYVBvZG9sb2dpYS9zb2xlLWZsb3ctbWFuYWdlci1tYWluL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgY29tcG9uZW50VGFnZ2VyIH0gZnJvbSBcImxvdmFibGUtdGFnZ2VyXCI7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiAoe1xuICBzZXJ2ZXI6IHtcbiAgICBob3N0OiBcIjo6XCIsXG4gICAgcG9ydDogODA4MCxcbiAgICBobXI6IHtcbiAgICAgIG92ZXJsYXk6IGZhbHNlLFxuICAgIH0sXG4gICAgYWxsb3dlZEhvc3RzOiBbXCJhbmgtYmlsbG93aWVyLWF0bGFzLm5ncm9rLWZyZWUuZGV2XCJdLFxuICAgIHByb3h5OiB7XG4gICAgICBcIi9hcGlcIjoge1xuICAgICAgICB0YXJnZXQ6IFwiaHR0cDovL2xvY2FsaG9zdDo4MDgwL1wiLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIHBsdWdpbnM6IFtyZWFjdCgpLCBtb2RlID09PSBcImRldmVsb3BtZW50XCIgJiYgY29tcG9uZW50VGFnZ2VyKCldLmZpbHRlcihCb29sZWFuKSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcbiAgICB9LFxuICAgIGRlZHVwZTogW1wicmVhY3RcIiwgXCJyZWFjdC1kb21cIiwgXCJyZWFjdC9qc3gtcnVudGltZVwiLCBcInJlYWN0L2pzeC1kZXYtcnVudGltZVwiLCBcIkB0YW5zdGFjay9yZWFjdC1xdWVyeVwiLCBcIkB0YW5zdGFjay9xdWVyeS1jb3JlXCJdLFxuICB9LFxuICAvKiogRXZpdGEgXCJPdXRkYXRlZCBPcHRpbWl6ZSBEZXBcIiBjb24gZGVwcyBhXHUwMEYxYWRpZGFzIG8gY2FjaFx1MDBFOSBkZSBWaXRlIGRlc2luY3Jvbml6YWRhICovXG4gIG9wdGltaXplRGVwczoge1xuICAgIGluY2x1ZGU6IFtcIkByYWRpeC11aS9yZWFjdC1zY3JvbGwtYXJlYVwiXSxcbiAgfSxcbn0pKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBZ2YsU0FBUyxvQkFBb0I7QUFDN2dCLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyx1QkFBdUI7QUFIaEMsSUFBTSxtQ0FBbUM7QUFNekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE9BQU87QUFBQSxFQUN6QyxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixLQUFLO0FBQUEsTUFDSCxTQUFTO0FBQUEsSUFDWDtBQUFBLElBQ0EsY0FBYyxDQUFDLG9DQUFvQztBQUFBLElBQ25ELE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxRQUNOLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxNQUNWO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVMsQ0FBQyxNQUFNLEdBQUcsU0FBUyxpQkFBaUIsZ0JBQWdCLENBQUMsRUFBRSxPQUFPLE9BQU87QUFBQSxFQUM5RSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxJQUNBLFFBQVEsQ0FBQyxTQUFTLGFBQWEscUJBQXFCLHlCQUF5Qix5QkFBeUIsc0JBQXNCO0FBQUEsRUFDOUg7QUFBQTtBQUFBLEVBRUEsY0FBYztBQUFBLElBQ1osU0FBUyxDQUFDLDZCQUE2QjtBQUFBLEVBQ3pDO0FBQ0YsRUFBRTsiLAogICJuYW1lcyI6IFtdCn0K
