import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    /** Permite abrir de outro PC/celular na mesma rede (use o IP que o Vite mostrar). */
    host: true,
  },
});
