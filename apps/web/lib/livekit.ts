import { apiFetch } from "./api";

export type LivekitTokenRequest = {
  kind: "live" | "videocall";
  roomName: string;
  streamId?: string;
  bookingId?: string;
};

export type LivekitTokenResponse = {
  token: string;
  url: string;
  roomName: string;
  canPublish: boolean;
};

export async function getLivekitToken(payload: LivekitTokenRequest) {
  return apiFetch<LivekitTokenResponse>("/livekit/token", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
