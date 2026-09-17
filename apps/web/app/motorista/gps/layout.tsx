import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Localização — motorista",
};

export default function MotoristaGpsLayout({ children }: { children: ReactNode }) {
  return children;
}
