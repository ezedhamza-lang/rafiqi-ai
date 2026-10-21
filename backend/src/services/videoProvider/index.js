import { config } from '../../config.js';
import { LocalVideoProvider } from './local.js';
import { LiveKitVideoProvider } from './livekit.js';

export const VIDEO_PROVIDER_LABELS = {
  LOCAL: 'مزوّد داخلي (تجريبي)',
  LIVEKIT: 'LiveKit'
};

const PROVIDERS = {
  LOCAL: (videoConfig) => new LocalVideoProvider(videoConfig),
  LIVEKIT: (videoConfig) => new LiveKitVideoProvider(videoConfig)
};

export function getVideoProvider() {
  const name = config.video.provider;
  const factory = PROVIDERS[name] || PROVIDERS.LOCAL;
  return factory(config.video);
}

// نقبل فقط روابط Google Meet الصحيحة (meet.google.com/abc-defg-hij) ونتجاهل
// أي قيمة أخرى حتى لا نعرض رابطًا مكسورًا أو خطيرًا للتلاميذ.
const MEET_URL_RE = /^https:\/\/meet\.google\.com\/([a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3})(?:[?#].*)?$/i;

export function sanitizeMeetUrl(value) {
  const match = String(value || '').trim().match(MEET_URL_RE);
  return match ? `https://meet.google.com/${match[1].toLowerCase()}` : '';
}

export function getVideoProviderInfo() {
  const provider = getVideoProvider();
  return {
    provider: provider.name,
    label: provider.label,
    livekitUrl: provider.name === 'LIVEKIT' ? provider.livekitUrl : null,
    meetUrl: sanitizeMeetUrl(config.video.meetUrl),
    supportsRecording: provider.supportsRecording,
    supportsInteractions: {
      chat: true,
      raiseHand: true,
      screenShare: true
    }
  };
}
