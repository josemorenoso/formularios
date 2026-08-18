import type { NextConfig } from "next";

/**
 * Rutas cortas para repartir por canal.
 *
 *   formulario.constelarys.com/mc  → el enlace del botón de ManyChat
 *   formulario.constelarys.com/wa  → el que pegas en el chat de WhatsApp
 *   formulario.constelarys.com/ig  → historias y bio de Instagram
 *
 * Son rutas de la aplicación, no subdominios: no se configuran en el DNS.
 * Funcionan en cualquier dominio donde esté desplegada, incluida la URL
 * provisional de Vercel.
 *
 * Cada una marca el origen en la URL, así no dependes de que el navegador
 * mande el referente (WhatsApp muchas veces no lo manda).
 */
const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/mc", destination: "/?src=manychat", permanent: false },
      { source: "/wa", destination: "/?src=whatsapp", permanent: false },
      { source: "/ig", destination: "/?src=instagram", permanent: false },
    ];
  },
};

export default nextConfig;
