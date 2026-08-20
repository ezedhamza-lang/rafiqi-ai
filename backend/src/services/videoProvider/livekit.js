import jwt from 'jsonwebtoken';

export class LiveKitVideoProvider {
  constructor(videoConfig) {
    this.name = 'LIVEKIT';
    this.label = 'LiveKit';
    this.livekitUrl = videoConfig.livekitUrl || null;
    this.supportsRecording = true;
    this.videoConfig = videoConfig;
  }

  _signToken({ roomName, canPublish }) {
    const { livekitApiKey, livekitApiSecret } = this.videoConfig;
    const now = Math.floor(Date.now() / 1000);
    const kid = String(livekitApiKey);
    return jwt.sign(
      {
        video: {
          room: roomName,
          roomJoin: true,
          canPublish: !!canPublish,
          canSubscribe: true
        },
        iss: kid,
        sub: kid,
        nbf: now,
        exp: now + 24 * 60 * 60,
        jti: `token-${Math.random().toString(36).slice(2, 12)}`,
        kid
      },
      String(livekitApiSecret),
      { algorithm: 'HS256', header: { alg: 'HS256', typ: 'JWT', kid } }
    );
  }

  async createRoom(session) {
    return { roomName: session.roomName };
  }

  async issueJoinToken({ session, canPublish }) {
    if (!this.videoConfig.livekitApiKey || !this.videoConfig.livekitApiSecret) {
      throw new Error('مزوّد LiveKit غير مُهيّأ: أضف LIVEKIT_URL و LIVEKIT_API_KEY و LIVEKIT_API_SECRET في .env');
    }
    const token = this._signToken({
      roomName: session.roomName,
      canPublish
    });
    return {
      roomName: session.roomName,
      token,
      canPublish: !!canPublish,
      serverUrl: this.livekitUrl
    };
  }

  async requestRecording() {
    return null;
  }

  async finalizeRecording({ session }) {
    return {
      providerRecordingId: `livekit-${session.roomName}-${Date.now()}`,
      title: `${session.title} (تسجيل LiveKit)`,
      fileUrl: null,
      sizeBytes: null,
      durationSec: null
    };
  }
}
