"use client";

import { useEffect, useRef } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "@/styles/portal-onboarding-tour.css";

const STEP_NOVA_SOLICITACAO: DriveStep = {
  element: '[data-tour="nova-solicitacao"]',
  popover: {
    title: "Solicitações",
    description:
      "Bem-vindo! Tudo começa aqui. Crie seus agendamentos de forma rápida e acompanhe o status em tempo real.",
    side: "top",
    align: "start",
  },
};

const STEP_FINANCEIRO: DriveStep = {
  element: () => pickVisibleTourTarget('[data-tour="nav-financeiro"]'),
  popover: {
    title: "Financeiro",
    description:
      "Suas faturas e boletos ficam organizados aqui. O sistema avisa sobre vencimentos para evitar bloqueios operacionais.",
    side: "bottom",
    align: "start",
  },
};

const STEP_AJUDA: DriveStep = {
  element: () => pickVisibleTourTarget('[data-tour="ajuda-perfil"]'),
  popover: {
    title: "Ajuda e perfil",
    description: "Ficou com dúvida? Acesse nossos tutoriais ou fale com o suporte por aqui.",
    side: "bottom",
    align: "end",
  },
};

function pickVisibleTourTarget(selector: string): Element {
  const nodes = Array.from(document.querySelectorAll(selector));
  const visible = nodes.find((el) => el.getClientRects().length > 0);
  return visible ?? nodes[0] ?? document.body;
}

function buildTourSteps(): DriveStep[] {
  const steps: DriveStep[] = [];
  if (document.querySelector('[data-tour="nova-solicitacao"]')) steps.push(STEP_NOVA_SOLICITACAO);
  if (document.querySelector('[data-tour="nav-financeiro"]')) steps.push(STEP_FINANCEIRO);
  if (document.querySelector('[data-tour="ajuda-perfil"]')) steps.push(STEP_AJUDA);
  return steps;
}

type UsePortalOnboardingTourOptions = {
  enabled: boolean;
  onComplete: () => void;
};

/** Product tour orgânico (driver.js) — página de solicitações, primeiro acesso. */
export function usePortalOnboardingTour({ enabled, onComplete }: UsePortalOnboardingTourOptions) {
  const startedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!enabled || startedRef.current) return;

    const timer = window.setTimeout(() => {
      if (startedRef.current) return;
      const steps = buildTourSteps();
      if (steps.length === 0) return;

      startedRef.current = true;
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        onCompleteRef.current();
      };

      const driverObj = driver({
        animate: true,
        overlayOpacity: 0.4,
        allowClose: true,
        overlayClickBehavior: "close",
        allowKeyboardControl: true,
        showProgress: true,
        progressText: "{{current}} de {{total}}",
        nextBtnText: "Próximo",
        prevBtnText: "Anterior",
        doneBtnText: "Concluir",
        showButtons: ["next", "previous", "close"],
        popoverClass: "portal-onboarding-popover",
        steps,
        onPopoverRender: (popover) => {
          popover.closeButton.textContent = "Pular Tour";
          popover.closeButton.setAttribute("aria-label", "Pular tour");
        },
        onCloseClick: (_el, _step, { driver: d }) => {
          finish();
          d.destroy();
        },
        onDoneClick: (_el, _step, { driver: d }) => {
          finish();
          d.destroy();
        },
        onDestroyed: () => {
          finish();
        },
      });

      driverObj.drive();
    }, 500);

    return () => window.clearTimeout(timer);
  }, [enabled]);
}
