import "./globals.css";
import AuthProvider from "@/components/auth/AuthProvider";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vesta",
  description: "Tu registro de finanzas personales, inteligente y moderno.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
