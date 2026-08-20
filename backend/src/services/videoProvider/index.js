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

export function getVideoProviderInfo() {
  const provider = getVideoProvider();
  return {
    provider: provider.name,
    label: provider.label,
    livekitUrl: provider.name === 'LIVEKIT' ? provider.livekitUrl : null,
    supportsRecording: provider.supportsRecording,
    supportsInteractions: {
      chat: true,
      raiseHand: true,
      screenShare: true
    }
  };
}
