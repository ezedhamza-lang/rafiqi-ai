export default function VideoCard({ video, onPlay }) {
  return (
    <div className="lesson-video-card">
      <button type="button" className="lesson-video-thumb" onClick={onPlay} title={video.title}>
        {video.thumbnail ? (
          <img src={video.thumbnail} alt={video.title} loading="lazy" />
        ) : (
          <span className="material-icons" style={{ fontSize: '3rem' }}>smart_display</span>
        )}
        <span className="lesson-video-play">
          <span className="material-icons">play_arrow</span>
        </span>
        {video.durationLabel && <span className="lesson-video-duration">{video.durationLabel}</span>}
      </button>
      <div className="lesson-video-info">
        <strong className="lesson-video-title">{video.title}</strong>
        {video.description && <p className="lesson-video-desc">{video.description}</p>}
        <div className="lesson-video-meta">
          {video.source && <span className="badge">{video.source}</span>}
          {video.providerLabel && <span className="badge accent">{video.providerLabel}</span>}
        </div>
      </div>
    </div>
  );
}
