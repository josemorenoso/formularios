import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Instrument_Sans } from "next/font/google";
import "./globals.css";

/* Bodoni para el nombre y los titulares: es la serif de alto contraste
   del manual. Instrument Sans para todo lo demás. Dos familias, nada más. */
const display = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const texto = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-texto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Constelarys · Postulación",
  description:
    "Once preguntas para contarnos qué proceso te está costando tiempo o plata. Respondemos por WhatsApp.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Constelarys · Postulación",
    description:
      "Once preguntas para contarnos qué proceso te está costando tiempo o plata.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#060d18",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Las variables van en <html>: globals.css las consume desde :root y una
    // custom property no puede leer otra definida en un descendiente.
    <html lang="es" className={`${display.variable} ${texto.variable}`}>
      <body>{children}</body>
    </html>
  );
}
