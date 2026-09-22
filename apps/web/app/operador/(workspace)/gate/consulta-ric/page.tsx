import { Suspense } from "react";
import { ConsultaRicList } from "@/components/gate/consulta-ric-list";

export default function ConsultaRicPage() {
  return (
    <div className="p-4">
      <Suspense fallback={null}>
        <ConsultaRicList />
      </Suspense>
    </div>
  );
}
