import type { Metadata } from "next";
import ProfileUsernamePage, {
  profileUsernameMetadata,
} from "../../../components/ProfileUsernamePage";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return profileUsernameMetadata(username);
}

export default async function EscortProfilePage({ params }: Props) {
  const { username } = await params;
  return <ProfileUsernamePage word="escort" username={username} />;
}
