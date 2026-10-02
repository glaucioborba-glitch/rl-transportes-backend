"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={className ?? "space-y-4"}>
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export const LazyCockpitKpisPanel = dynamic(
  () =>
    import("@/components/cockpit/cockpit-kpis-panel").then((m) => ({
      default: m.CockpitKpisPanel,
    })),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  },
);

export const LazyVisaoOperacionalPanel = dynamic(
  () =>
    import("@/components/bi/visao-operacional-panel").then((m) => ({
      default: m.VisaoOperacionalPanel,
    })),
  {
    ssr: false,
    loading: () => <ChartSkeleton className="space-y-3" />,
  },
);

export const LazyTwin3DScene = dynamic(
  () =>
    import("@/components/digital-twin/twin-3d-scene").then((m) => ({
      default: m.Twin3DScene,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[420px] w-full rounded-2xl" />,
  },
);
