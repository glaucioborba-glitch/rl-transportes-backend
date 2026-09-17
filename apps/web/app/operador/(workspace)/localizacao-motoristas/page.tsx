import type { Metadata } from "next";
import { MotoristaLocalizacaoBoard } from "@/components/motorista-gps/motorista-localizacao-board";

export const metadata: Metadata = {
  title: "Localização",
};

export default function LocalizacaoMotoristasPage() {
  return <MotoristaLocalizacaoBoard />;
}
