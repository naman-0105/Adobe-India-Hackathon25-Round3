// import { defineConfig } from "vite";
// import react from "@vitejs/plugin-react-swc";
// import path from "path";
// import dotenv from 'dotenv';
// import { componentTagger } from "lovable-tagger";

// dotenv.config();

// // https://vitejs.dev/config/
// export default defineConfig(({ mode }) => ({
//   build: {
//     sourcemap: true
//   },
//   server: {
//     host: "::",
//     port: 8080,
//   },
//   plugins: [
//     react(),
//     mode === 'development' &&
//     componentTagger(),
//   ].filter(Boolean),
//   resolve: {
//     alias: {
//       "@": path.resolve(__dirname, "./src"),
//     },
//   },
// }));


import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import dotenv from 'dotenv';
import { componentTagger } from "lovable-tagger";

// This loads the variables from your .env file into process.env
dotenv.config();

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // ADD THIS SECTION
  // This 'define' block makes the environment variable available in your client-side code.
  // It performs a direct text replacement during the build process.
  define: {
    // The key is what you'll use in your code (e.g., process.env.ADOBE_EMBED_API_KEY)
    // The value is the actual key from your .env file, wrapped in JSON.stringify
    'process.env.ADOBE_EMBED_API_KEY': JSON.stringify(process.env.ADOBE_EMBED_API_KEY)
  },

  // --- Your existing configuration ---
  build: {
    sourcemap: true
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
