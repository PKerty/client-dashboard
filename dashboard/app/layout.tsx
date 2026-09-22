import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clientes",
  description: "Situación de cada cliente",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
