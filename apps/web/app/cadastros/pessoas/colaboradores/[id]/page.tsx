import { redirect } from "next/navigation";

type Props = { params: { id: string } };

export default function CadastrosColaboradorRedirectPage({ params }: Props) {
  redirect(`/rh/colaboradores/${params.id}`);
}
