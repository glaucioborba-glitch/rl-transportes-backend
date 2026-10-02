"use client";

import { useEffect, useRef, useState } from "react";
import { fetchStaffMotoristaExterno } from "@/lib/api/cadastros-motoristas-externos-client";
import { fetchPortalMotoristaExterno } from "@/lib/api/portal-client";
import {
  MSG_MOTORISTA_INDISPONIVEL_PORTAL,
  motoristaSuspensoMensagem,
} from "@/lib/catalogo-motorista-externo";

export function useMotoristaCpfAutofill({
  cpf,
  nome,
  setNome,
  source,
}: {
  cpf: string;
  nome: string;
  setNome: (nome: string) => void;
  source: "portal" | "staff";
}) {
  const [hint, setHint] = useState("");
  const [bloqueio, setBloqueio] = useState<string | null>(null);
  const nomeRef = useRef(nome);
  nomeRef.current = nome;

  useEffect(() => {
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11) {
      setHint("");
      setBloqueio(null);
      return;
    }
    let cancel = false;
    const lookup = source === "staff" ? fetchStaffMotoristaExterno : fetchPortalMotoristaExterno;
    void lookup(digits)
      .then((hit) => {
        if (cancel) return;
        if (!hit) {
          setHint("");
          setBloqueio(null);
          return;
        }
        if (!nomeRef.current.trim()) setNome(hit.nome);
        if (hit.suspenso) {
          setBloqueio(
            source === "portal" ? MSG_MOTORISTA_INDISPONIVEL_PORTAL : motoristaSuspensoMensagem(hit),
          );
          setHint("");
        } else {
          setBloqueio(null);
          setHint("Nome preenchido pelo cadastro deste terminal");
        }
      })
      .catch(() => {
        if (!cancel) {
          setHint("");
          setBloqueio(null);
        }
      });
    return () => {
      cancel = true;
    };
  }, [cpf, setNome, source]);

  return { hint, bloqueio };
}
