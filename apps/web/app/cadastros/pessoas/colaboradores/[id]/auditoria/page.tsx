import { redirect } from "next/navigation";

type Props = { params: { id: string } };

export default function CadastrosColaboradorAuditoriaRedirectPage({ params }: Props) {
  redirect(`/rh/colaboradores/${params.id}/auditoria`);
}
