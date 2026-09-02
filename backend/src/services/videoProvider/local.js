import path from 'path';
import fs from 'fs';
import { generateDemoWav } from './wav.js';

export class LocalVideoProvider {
  constructor(videoConfig) {
    this.name = 'LOCAL';
    this.label = 'مزوّد داخلي (تجريبي)';
    this.livekitUrl = null;
    this.supportsRecording = true;
    this.videoConfig = videoConfig;
  }

  async createRoom(session) {
    return { roomName: session.roomName };
  }

  async issueJoinToken({ session, user, canPublish }) {
    return {
      roomName: session.roomName,
      token: `local-${session.roomName}-${user.id}`,
      canPublish: !!canPublish,
      serverUrl: null
    };
  }

  async requestRecording() {
    return null;
  }

  async finalizeRecording({ session }) {
    const durationSec = Math.max(
      5,
      Math.min(60, Math.round((new Date(session.endsAt) - new Date(session.startsAt)) / 1000))
    );
    const dir = path.resolve(process.cwd(), this.videoConfig.recordingDir || 'uploads/recordings');
    fs.mkdirSync(dir, { recursive: true });
    const safe = String(session.roomName || session.id).replace(/[^a-zA-Z0-9_-]/g, '-');
    const fileName = `${safe}-${Date.now()}.wav`;
    const filePath = path.join(dir, fileName);
    const sizeBytes = generateDemoWav(filePath, durationSec);
    return {
      providerRecordingId: `local-${safe}-${Date.now()}`,
      title: `${session.title} (تسجيل تجريبي)`,
      fileUrl: `/uploads/recordings/${fileName}`,
      sizeBytes,
      durationSec
    };
  }
}
