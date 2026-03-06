import { apiFetch } from "./api";

/* ── STUN/TURN servers ── */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
];

const RTC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 10,
};

/* ── Get user media ── */
export async function getLocalMedia(
  opts: { video?: boolean | MediaTrackConstraints; audio?: boolean } = {},
): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    audio: opts.audio ?? true,
    video: opts.video ?? {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 30 },
      facingMode: "user",
    },
  };
  return navigator.mediaDevices.getUserMedia(constraints);
}

/* ── Signaling helpers ── */
async function sendSignal(
  type: "offer" | "answer" | "ice",
  targetUserId: string,
  payload: Record<string, any>,
) {
  await apiFetch(`/signal/${type}`, {
    method: "POST",
    body: JSON.stringify({ targetUserId, ...payload }),
  });
}

/* ── Peer Connection wrapper ── */
export type PeerEvents = {
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionState?: (state: RTCPeerConnectionState) => void;
  onIceState?: (state: RTCIceConnectionState) => void;
};

export class WebRTCPeer {
  pc: RTCPeerConnection;
  targetUserId: string;
  bookingId: string | null;
  streamId: string | null;
  private events: PeerEvents;
  private pendingIce: RTCIceCandidateInit[] = [];
  private hasRemoteDesc = false;

  constructor(
    targetUserId: string,
    events: PeerEvents,
    opts?: { bookingId?: string; streamId?: string },
  ) {
    this.targetUserId = targetUserId;
    this.bookingId = opts?.bookingId ?? null;
    this.streamId = opts?.streamId ?? null;
    this.events = events;
    this.pc = new RTCPeerConnection(RTC_CONFIG);

    // Forward ICE candidates to remote via signaling
    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal("ice", targetUserId, {
          bookingId: this.bookingId,
          streamId: this.streamId,
          candidate: e.candidate.toJSON(),
        });
      }
    };

    // Receive remote tracks
    this.pc.ontrack = (e) => {
      if (e.streams[0]) {
        this.events.onRemoteStream?.(e.streams[0]);
      }
    };

    this.pc.onconnectionstatechange = () => {
      this.events.onConnectionState?.(this.pc.connectionState);
    };

    this.pc.oniceconnectionstatechange = () => {
      this.events.onIceState?.(this.pc.iceConnectionState);
    };
  }

  /** Add local stream tracks to the peer connection */
  addStream(stream: MediaStream) {
    for (const track of stream.getTracks()) {
      this.pc.addTrack(track, stream);
    }
  }

  /** Create and send an SDP offer (caller side) */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    await sendSignal("offer", this.targetUserId, {
      bookingId: this.bookingId,
      streamId: this.streamId,
      sdp: offer,
    });

    return offer;
  }

  /** Handle incoming SDP offer and send answer (callee side) */
  async handleOffer(sdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    this.hasRemoteDesc = true;
    await this.flushPendingIce();

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    await sendSignal("answer", this.targetUserId, {
      bookingId: this.bookingId,
      streamId: this.streamId,
      sdp: answer,
    });

    return answer;
  }

  /** Handle incoming SDP answer (caller side) */
  async handleAnswer(sdp: RTCSessionDescriptionInit) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    this.hasRemoteDesc = true;
    await this.flushPendingIce();
  }

  /** Handle incoming ICE candidate */
  async handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.hasRemoteDesc) {
      this.pendingIce.push(candidate);
      return;
    }
    await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  private async flushPendingIce() {
    for (const c of this.pendingIce) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        // ignore stale candidates
      }
    }
    this.pendingIce = [];
  }

  /** Close connection and cleanup */
  close() {
    this.pc.close();
  }
}
