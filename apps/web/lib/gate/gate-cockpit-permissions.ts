import type { StaffUser } from "@/stores/staffAuthStore";

export function podeAprovarOs(user: StaffUser | null): boolean {
  const role = user?.role ?? "";
  return role === "ADMIN" || role === "GERENTE" || role === "SUPER_ADMIN";
}

export function podeOperarGate(user: StaffUser | null): boolean {
  const role = user?.role ?? "";
  return (
    role === "ADMIN" ||
    role === "GERENTE" ||
    role === "SUPER_ADMIN" ||
    role === "OPERADOR_GATE"
  );
}

export function podeMoverPatio(user: StaffUser | null): boolean {
  return podeOperarGate(user);
}
