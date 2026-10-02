import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fretes",
};

export default function FretesLayout({ children }: { children: React.ReactNode }) {
  return children;
}