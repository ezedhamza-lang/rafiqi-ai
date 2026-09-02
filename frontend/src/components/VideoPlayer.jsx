import { useState } from 'react';

export default function VideoPlayer({ video }) {
  const [loaded, setLoaded] = useState(false);
  if (!video) return null;

  const isDirect = video.provider === 'direct';
  const src = video.embedUrl || video.url;

  return (
    <div className="video-player">
      {isDirect ? (
        <video
          className="video-player-frame"
          controls
          preload="metadata"
          src={src}
          onLoadedData={() => setLoaded(true)}
        />
      ) : src ? (
        <iframe
          className="video-player-frame"
          src={src}
          title={video.title || 'فيديو تعليمي'}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          onLoad={() => setLoaded(true)}
        />
      ) : null}
      {!loaded && src && (
        <div className="video-player-placeholder">
          <span className="material-icons">play_circle</span>
          <span>جارٍ تحميل الفيديو…</span>
        </div>
      )}
      {!src && (
        <div className="video-player-error">
          <span className="material-icons">videocam_off</span>
          <span>لا يمكن عرض هذا الفيديو حالياً.</span>
        </div>
      )}
    </div>
  );
}
