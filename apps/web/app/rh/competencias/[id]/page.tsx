"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchRhColaboradorById } from "@/lib/rh/merge-directory";
import { hashSeed } from "@/lib/rh/hash";
import {
  competencyMatrixForUser,
  elegibilidadeOperacionalLabel,
  mockNrPack,
} from "@/lib/rh/nr-skills-mock";
import type { RhColaboradorDirectoryItem } from "@/lib/rh/types";
import { CertificateUploader } from "@/components/rh/certificate-uploader";
import { RadarCompetencyChart } from "@/components/rh/radar-competency-chart";
import { TrainingTimeline } from "@/components/rh/training-timeline";
import { RhCard } from "@/components/rh/rh-card";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

export default function RhCompetenciaDetailPage() {
  const params = useParams();
  const idRaw = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [row, setRow] = useState<RhColaboradorDirectoryItem | null>(null);

  const load = useCallback(async () => {
    if (!idRaw) return;
    const r = await fetchRhColaboradorById(decodeURIComponent(idRaw));
    setRow(r);
  }, [idRaw]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed) return <p className="text-amber-400">Acesso restrito.</p>;
  if (!row) {
    return (
      <div>
        <Link href="/rh/competencias" className="text-cyan-400 text-sm">
          ← Voltar
        </Link>
        <p className="mt-4 text-zinc-500">Não encontrado.</p>
      </div>
    );
  }

  const nr = mockNrPack(row.id, { admin: row.role === "ADMIN" || row.role === "GERENTE" });
  const matrix = competencyMatrixForUser(row.id, row.role);
  const el = elegibilidadeOperacionalLabel({ matrix, nr, status: row.status });

  const radar = [
    55 + (hashSeed(row.id) % 25),
    60 + (hashSeed(row.id + "s") % 20),
    50 + (hashSeed(row.id + "e") % 30),
    58 + (hashSeed(row.id + "c") % 22),
    52 + (hashSeed(row.id + "f") % 28),
  ];

  const timelineNr = nr;
  const roleChanges = [
    { at: row.dataAdmissao ?? "—", label: `Admissão · ${row.cargo ?? "cargo"}` },
    { at: "2025-08-01", label: `Atualização papel → ${row.role}` },
  ];

  return (
    <div className="space-y-6">
      <Link href="/rh/competencias" className="text-sm text-cyan-400 hover:underline">
        ← Competências
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-white">{row.nome}</h1>
        <p className="text-sm text-zinc-500">
          Elegibilidade:{" "}
          <span
            className={
              el === "APTO" ? "text-emerald-400" : el === "EM RECICLAGEM" ? "text-amber-300" : "text-red-300"
            }
          >
            {el}
          </span>
        </p>
      </div>
      <RhCard title="Linha do tempo" subtitle="Cursos · reciclagens · papel">
        <TrainingTimeline nr={timelineNr} roleChanges={roleChanges} />
      </RhCard>
      <RhCard title="Radar de competências (mock)">
        <RadarCompetencyChart values={radar} />
      </RhCard>
      <RhCard title="Certificados locais">
        <CertificateUploader label="Competência técnica consolidada" />
      </RhCard>
    </div>
  );
}
