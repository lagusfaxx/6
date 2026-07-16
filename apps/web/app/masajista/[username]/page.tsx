import type { Metadata } from "next";
import ProfileUsernamePage, {
  profileUsernameMetadata,
} from "../../../components/ProfileUsernamePage";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return profileUsernameMetadata(username);
}

export default async function MasajistaProfilePage({ params }: Props) {
  const { username } = await params;
  return <ProfileUsernamePage word="masajista" username={username} />;
}
