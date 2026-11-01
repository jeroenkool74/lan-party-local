import { useEffect, useRef, useState } from 'react'
import { osMeta, toHref } from '../utils/catalog'
import type { InstructionVideo, OperatingSystem } from '../types/catalog'

const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

interface InstructionVideosProps {
  videos: InstructionVideo[]
  visitorOs?: OperatingSystem
}

function getInitialOs(videos: InstructionVideo[], visitorOs?: OperatingSystem) {
  if (!visitorOs) {
    return videos[0]?.os
  }

  // Bekend systeem zonder eigen video: niets automatisch tonen, wel de andere aanbieden.
  return videos.some((video) => video.os === visitorOs) ? visitorOs : undefined
}

function formatRate(rate: number) {
  return `${rate.toLocaleString('nl-NL')}×`
}

export function InstructionVideos({ videos, visitorOs }: InstructionVideosProps) {
  const [selectedOs, setSelectedOs] = useState(() => getInitialOs(videos, visitorOs))
  const [playbackRate, setPlaybackRate] = useState(1)
  const videoRef = useRef<HTMLVideoElement>(null)

  const selectedVideo = videos.find((video) => video.os === selectedOs)
  const visitorHasVideo = videos.some((video) => video.os === visitorOs)

  useEffect(() => {
    const element = videoRef.current

    if (!element) {
      return
    }

    element.defaultPlaybackRate = playbackRate
    element.playbackRate = playbackRate
  }, [playbackRate, selectedVideo?.href])

  const applyRate = () => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate
    }
  }

  return (
    <section className="surface-panel" id="instructievideo">
      <div className="surface-panel__header">
        <div>
          <p className="section-kicker">Instructievideo</p>
          <h2>Zo installeer je het spel</h2>
        </div>
      </div>

      {visitorOs && !visitorHasVideo ? (
        <p className="video-panel__notice">
          Er is geen instructievideo voor {osMeta[visitorOs].label}. Je kunt wel de
          video voor een ander systeem bekijken.
        </p>
      ) : null}

      <div className="video-tabs" role="tablist" aria-label="Instructievideo per systeem">
        {videos.map((video) => {
          const isActive = video.os === selectedOs

          return (
            <button
              key={video.os}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`video-tab${isActive ? ' video-tab--active' : ''}`}
              onClick={() => setSelectedOs(video.os)}
            >
              <img
                src={osMeta[video.os].icon}
                alt=""
                aria-hidden="true"
                className="platform-pill__icon"
              />
              <span>{osMeta[video.os].label}</span>
              {video.os === visitorOs ? <small>jouw systeem</small> : null}
            </button>
          )
        })}
      </div>

      {selectedVideo ? (
        <div className="video-panel">
          <video
            key={selectedVideo.href}
            ref={videoRef}
            className="video-panel__player"
            src={toHref(selectedVideo.href)}
            controls
            playsInline
            preload="metadata"
            onLoadedMetadata={applyRate}
          >
            Je browser kan deze video niet afspelen.{' '}
            <a href={toHref(selectedVideo.href)}>Download de video</a>.
          </video>

          <div className="video-speed" role="group" aria-label="Afspeelsnelheid">
            <span className="video-speed__label">Snelheid</span>
            {playbackRates.map((rate) => (
              <button
                key={rate}
                type="button"
                aria-pressed={rate === playbackRate}
                className={`video-speed__option${
                  rate === playbackRate ? ' video-speed__option--active' : ''
                }`}
                onClick={() => setPlaybackRate(rate)}
              >
                {formatRate(rate)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
