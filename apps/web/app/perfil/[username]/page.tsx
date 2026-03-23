import { redirect } from "next/navigation";

type Props = { params: Promise<{ username: string }> };

export default async function PerfilAliasPage({ params }: Props) {
  const { username } = await params;
  redirect(`/profile/${username}`);
}
