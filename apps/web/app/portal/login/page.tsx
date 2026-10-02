import PortalLoginForm from "./login-form";
import { sanitizePortalNext } from "@/lib/portal-redirect";

/** CTAs Cadastrar-se / Esqueci minha senha: ver `login-form.tsx` (abaixo do botão Entrar). */

export const metadata = {
  title: "Login | Portal RL Transportes",
};

export default function PortalLoginPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const redirectAfterLogin = sanitizePortalNext(searchParams.next);
  return <PortalLoginForm redirectAfterLogin={redirectAfterLogin} />;
}
