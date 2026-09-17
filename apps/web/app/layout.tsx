import type { Metadata } from "next";
import localFont from "next/font/local";
import { ClientStaffHydrator } from "@/components/staff/client-staff-hydrator";
import { ThemeRoot } from "@/components/theme-root";
import { MoedaCorrenteSync } from "@/components/moeda-corrente-sync";
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
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen font-sans antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if((location.pathname||"/")==="/")return;var t=JSON.parse(localStorage.getItem("rl-portal-theme")||"{}");var m=t.state&&t.state.mode;if(m==="light"){var r=document.documentElement;r.classList.remove("dark");r.classList.add("light");r.dataset.theme="light";r.style.colorScheme="light";}}catch(e){}})();`,
          }}
        />
        <ClientStaffHydrator />
        <ThemeRoot />
        <MoedaCorrenteSync />
        {children}
      </body>
    </html>
  );
}
