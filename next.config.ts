import type { NextConfig } from "next";

/**
 * Rutas cortas para repartir por canal.
 *
 *   constelarys.com/mc  → el enlace que pones en el botón de ManyChat
 *   constelarys.com/wa  → el que pegas en el chat de WhatsApp
 *   constelarys.com/ig  → historias y bio de Instagram
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
