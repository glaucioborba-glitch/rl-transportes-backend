import { Suspense } from "react";
import LoginForm from "./login-form";

export const metadata = {
  title: "Login | Portal RL Transportes",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#080a0d] text-slate-400">
          Carregando…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
