import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { ClientStaffHydrator } from "@/components/staff/client-staff-hydrator";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "RL Transportes — Portal do Cliente",
  description: "Portal B2B logístico RL Transportes",
  manifest: "/manifest.json",
  themeColor: "#06b6d4",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RL Gate",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen font-sans antialiased`}>
        <ClientStaffHydrator />
        {children}
        <Toaster richColors position="top-center" theme="dark" />
      </body>
    </html>
  );
}
