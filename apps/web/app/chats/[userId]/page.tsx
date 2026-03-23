import { redirect } from "next/navigation";

type Props = { params: Promise<{ userId: string }> };

export default async function ChatsUserAliasPage({ params }: Props) {
  const { userId } = await params;
  redirect(`/chat/${userId}`);
}
