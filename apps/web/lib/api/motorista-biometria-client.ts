import { staffJson } from "@/lib/api/staff-client";

export type MotoristaBiometriaStatus = {
  enrolled: boolean;
  enrolledAt: string | null;
  firText: string | null;
};

export async function getMotoristaBiometria(cpf: string) {
  const digits = cpf.replace(/\D/g, "");
  return staffJson<MotoristaBiometriaStatus>(`/v2/gate/biometria/${encodeURIComponent(digits)}`);
}

export async function putMotoristaBiometria(cpf: string, firText: string) {
  const digits = cpf.replace(/\D/g, "");
  return staffJson<{ enrolled: boolean; enrolledAt: string; cpf: string }>(
    `/v2/gate/biometria/${encodeURIComponent(digits)}`,
    { method: "PUT", body: JSON.stringify({ firText }) },
  );
}

export async function deleteMotoristaBiometria(cpf: string) {
  const digits = cpf.replace(/\D/g, "");
  return staffJson<{ enrolled: boolean; cpf: string }>(
    `/v2/gate/biometria/${encodeURIComponent(digits)}`,
    { method: "DELETE" },
  );
}
