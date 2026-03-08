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

/* ── Bitrate limits (kbps) ── */
const VIDEO_MAX_BITRATE = 500_000; // 500kbps - smooth for videocalls
const VIDEO_START_BITRATE = 300_000; // start conservative
const AUDIO_MAX_BITRATE = 48_000; // 48kbps opus

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

  // Lower resolution for smoother video - 480p is plenty for videocalls
  const videoConstraints: boolean | MediaTrackConstraints = opts.video === false
    ? false
    : opts.video && typeof opts.video === "object"
      ? opts.video
      : isIOS
        ? { facingMode: "user", width: { ideal: 480 }, height: { ideal: 360 } }
        : {
            width: { ideal: 640, max: 960 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 24, max: 24 },
            facingMode: "user",
          };

  const constraints: MediaStreamConstraints = {
    audio: wantsAudio
      ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
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
  private bitrateInterval: any = null;

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

      // Apply bitrate limits once connected
      if (this.pc.connectionState === "connected") {
        this.applyBitrateLimits();
      }
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

  /** Apply bitrate limits to senders for smooth video */
  private async applyBitrateLimits() {
    // Small delay to let connection stabilize
    await new Promise((r) => setTimeout(r, 500));

    for (const sender of this.pc.getSenders()) {
      if (!sender.track) continue;
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }

      if (sender.track.kind === "video") {
        params.encodings[0].maxBitrate = VIDEO_MAX_BITRATE;
        // Degrade resolution before framerate when bandwidth is low
        if ("degradationPreference" in params) {
          (params as any).degradationPreference = "maintain-framerate";
        }
        // Scale down if needed
        params.encodings[0].scaleResolutionDownBy = params.encodings[0].scaleResolutionDownBy || 1;
      } else if (sender.track.kind === "audio") {
        params.encodings[0].maxBitrate = AUDIO_MAX_BITRATE;
      }

      try {
        await sender.setParameters(params);
      } catch {
        // some browsers don't support setParameters
      }
    }

    // Start monitoring and adapting bitrate
    this.startBitrateMonitor();
  }

  /** Monitor connection quality and adapt bitrate */
  private startBitrateMonitor() {
    clearInterval(this.bitrateInterval);
    let prevBytesSent = 0;
    let prevTimestamp = 0;
    let consecutiveLow = 0;

    this.bitrateInterval = setInterval(async () => {
      if (this.pc.connectionState !== "connected") return;

      try {
        const stats = await this.pc.getStats();
        stats.forEach((report) => {
          if (report.type === "outbound-rtp" && report.kind === "video") {
            if (prevTimestamp > 0) {
              const timeDelta = (report.timestamp - prevTimestamp) / 1000;
              const bytesDelta = report.bytesSent - prevBytesSent;
              const currentBitrate = (bytesDelta * 8) / timeDelta;

              // If actual bitrate is very low, connection is struggling
              if (currentBitrate < 50_000 && timeDelta > 0) {
                consecutiveLow++;
                // After 3 consecutive low readings, reduce quality further
                if (consecutiveLow >= 3) {
                  this.reduceVideoQuality();
                  consecutiveLow = 0;
                }
              } else {
                consecutiveLow = 0;
              }
            }
            prevBytesSent = report.bytesSent;
            prevTimestamp = report.timestamp;
          }
        });
      } catch {
        // stats not available
      }
    }, 3000);
  }

  /** Reduce video quality when bandwidth is constrained */
  private async reduceVideoQuality() {
    for (const sender of this.pc.getSenders()) {
      if (sender.track?.kind !== "video") continue;
      const params = sender.getParameters();
      if (!params.encodings?.[0]) continue;

      const currentScale = params.encodings[0].scaleResolutionDownBy || 1;
      const currentBitrate = params.encodings[0].maxBitrate || VIDEO_MAX_BITRATE;

      // Scale down resolution (max 4x = 120p from 480p)
      if (currentScale < 4) {
        params.encodings[0].scaleResolutionDownBy = Math.min(4, currentScale + 1);
      }
      // Also reduce bitrate
      params.encodings[0].maxBitrate = Math.max(100_000, currentBitrate * 0.7);

      try {
        await sender.setParameters(params);
      } catch {}
    }
  }

  /** Add local stream tracks to the peer connection */
  addStream(stream: MediaStream) {
    for (const track of stream.getTracks()) {
      this.pc.addTrack(track, stream);
    }
  }

  /** Ensure transceivers exist for receiving even without local media */
  ensureReceiveTransceivers() {
    const transceivers = this.pc.getTransceivers();
    const hasAudio = transceivers.some((t) => t.receiver.track.kind === "audio");
    const hasVideo = transceivers.some((t) => t.receiver.track.kind === "video");
    if (!hasAudio) {
      this.pc.addTransceiver("audio", { direction: "recvonly" });
    }
    if (!hasVideo) {
      this.pc.addTransceiver("video", { direction: "recvonly" });
    }
  }

  /** Create and send an SDP offer (caller side) */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    // Apply bandwidth limits to SDP
    const modifiedSdp = this.applyBandwidthToSdp(offer.sdp || "");
    const modifiedOffer = { ...offer, sdp: modifiedSdp };

    await this.pc.setLocalDescription(modifiedOffer);

    // Send offer immediately (don't wait for ICE gathering)
    await sendSignal("offer", this.targetUserId, {
      bookingId: this.bookingId,
      streamId: this.streamId,
      sdp: modifiedOffer,
    });

    return modifiedOffer;
  }

  /** Handle incoming SDP offer and send answer (callee side) */
  async handleOffer(sdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    this.hasRemoteDesc = true;
    await this.flushPendingIce();

    const answer = await this.pc.createAnswer();
    const modifiedSdp = this.applyBandwidthToSdp(answer.sdp || "");
    const modifiedAnswer = { ...answer, sdp: modifiedSdp };

    await this.pc.setLocalDescription(modifiedAnswer);

    // Send answer immediately (trickle ICE)
    await sendSignal("answer", this.targetUserId, {
      bookingId: this.bookingId,
      streamId: this.streamId,
      sdp: modifiedAnswer,
    });

    return modifiedAnswer;
  }

  /** Apply bandwidth limits directly in SDP for broader browser support */
  private applyBandwidthToSdp(sdp: string): string {
    let modified = sdp;

    // Add b=AS (Application Specific) bandwidth limit for video
    // This is the most compatible way to limit bandwidth
    modified = modified.replace(
      /(m=video.*\r\n)/,
      `$1b=AS:${Math.floor(VIDEO_MAX_BITRATE / 1000)}\r\n`
    );

    // Add b=AS for audio
    modified = modified.replace(
      /(m=audio.*\r\n)/,
      `$1b=AS:${Math.floor(AUDIO_MAX_BITRATE / 1000)}\r\n`
    );

    return modified;
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
    clearInterval(this.bitrateInterval);
    this.pc.close();
  }
}
