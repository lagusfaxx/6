import { apiFetch } from "./api";

const DEFAULT_TURN_SERVERS: RTCIceServer[] = [
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turns:openrelay.metered.ca:443",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

function parseIceServerUrls(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/* ── STUN/TURN servers ── */
const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const envTurnUrls = parseIceServerUrls(process.env.NEXT_PUBLIC_TURN_URLS);
const envTurnServer = envTurnUrls.length > 0
  ? [{
      urls: envTurnUrls,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    } satisfies RTCIceServer]
  : [];

const ICE_SERVERS: RTCIceServer[] = [
  ...STUN_SERVERS,
  ...(envTurnServer.length > 0 ? envTurnServer : DEFAULT_TURN_SERVERS),
];

const RTC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 10,
  iceTransportPolicy: "all",
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
};

/* ── Detect iOS / Android PWA ── */
function isIOSPWA(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = (window.navigator as any).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  return isIOS && isStandalone;
}

function isAndroidPWA(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  return isAndroid && isStandalone;
}

/* ── Get user media with robust mobile PWA support ── */
export async function getLocalMedia(
  opts: { video?: boolean | MediaTrackConstraints; audio?: boolean } = {},
): Promise<MediaStream> {
  const wantsAudio = opts.audio !== false;
  const wantsVideo = opts.video !== false;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new DOMException(
      "Tu navegador no soporta acceso a cámara o micrófono en este contexto. Usa HTTPS o la app instalada.",
      "NotSupportedError",
    );
  }

  const isMobilePWA = isIOSPWA() || isAndroidPWA();

  if (!isMobilePWA && navigator.permissions) {
    try {
      const camPerm = await navigator.permissions.query({ name: "camera" as PermissionName });
      const micPerm = await navigator.permissions.query({ name: "microphone" as PermissionName });
      if (camPerm.state === "denied" || micPerm.state === "denied") {
        throw new DOMException(
          "Permisos de cámara o micrófono denegados. Actívalos en la configuración de tu navegador.",
          "NotAllowedError",
        );
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "NotAllowedError") throw e;
    }
  }

  const isIOS = isIOSPWA() || (/iPad|iPhone|iPod/.test(navigator.userAgent || ""));

  const videoConstraints: boolean | MediaTrackConstraints = opts.video === false
    ? false
    : opts.video && typeof opts.video === "object"
      ? opts.video
      : isIOS
        ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
        : {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 30 },
            facingMode: "user",
          };

  const constraints: MediaStreamConstraints = {
    audio: wantsAudio
      ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      : false,
    video: videoConstraints,
  };

  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (firstError) {
    const fallbackAttempts: MediaStreamConstraints[] = [];

    if ((isIOS || isMobilePWA) && wantsAudio && wantsVideo) {
      fallbackAttempts.push({ audio: true, video: true });
    }

    if (wantsAudio && wantsVideo) {
      fallbackAttempts.push({ audio: true, video: false });
      fallbackAttempts.push({ audio: false, video: true });
    }

    for (const fallback of fallbackAttempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(fallback);
        if (stream.getTracks().length > 0) return stream;
      } catch {
        // continue trying next fallback
      }
    }

    throw firstError;
  }
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
  onIceGatheringComplete?: () => void;
};

export class WebRTCPeer {
  pc: RTCPeerConnection;
  targetUserId: string;
  bookingId: string | null;
  streamId: string | null;
  private events: PeerEvents;
  private pendingIce: RTCIceCandidateInit[] = [];
  private hasRemoteDesc = false;
  private iceGatheringTimeout: any = null;

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

    // Trickle ICE - send candidates immediately as they arrive
    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal("ice", targetUserId, {
          bookingId: this.bookingId,
          streamId: this.streamId,
          candidate: e.candidate.toJSON(),
        });
      }
    };

    // Track ICE gathering completion for timeout optimization
    this.pc.onicegatheringstatechange = () => {
      if (this.pc.iceGatheringState === "complete") {
        clearTimeout(this.iceGatheringTimeout);
        this.events.onIceGatheringComplete?.();
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

      // Aggressive ICE restart on failure
      if (this.pc.iceConnectionState === "failed") {
        try {
          this.pc.restartIce();
        } catch {
          // restartIce not supported on all browsers
        }
      }
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
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.pc.setLocalDescription(offer);

    // Send offer immediately (don't wait for ICE gathering)
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

    // Send answer immediately (trickle ICE)
    await sendSignal("answer", this.targetUserId, {
      bookingId: this.bookingId,
      streamId: this.streamId,
      sdp: answer,
    });

    return answer;
  }

  /** Handle incoming SDP answer (caller side) */
  async handleAnswer(sdp: RTCSessionDescriptionInit) {
    if (this.pc.signalingState !== "have-local-offer") return;
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
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // ignore stale candidates
    }
  }

  private async flushPendingIce() {
    const candidates = [...this.pendingIce];
    this.pendingIce = [];
    await Promise.all(
      candidates.map((c) =>
        this.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
      )
    );
  }

  /** Close connection and cleanup */
  close() {
    clearTimeout(this.iceGatheringTimeout);
    this.pc.close();
  }
}
