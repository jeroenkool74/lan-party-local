import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { GameEntry, OperatingSystemFilter } from '../types/catalog'
import {
  countDirectDownloads,
  getPreferredPlatform,
  getPrimaryDownloadLink,
  getStatusCopy,
  osMeta,
  toHref,
  getVisitorDownloadPlatform,
  getVisitorOs,
} from '../utils/catalog'

interface GameCardProps {
  game: GameEntry
  activeFilter: OperatingSystemFilter
}

export function GameCard({ game, activeFilter }: GameCardProps) {
  const preferredPlatform = getPreferredPlatform(game, activeFilter)
  const downloadCount = countDirectDownloads(game)
  const visitorOs = getVisitorOs()
  const visitorDownloadPlatform = getVisitorDownloadPlatform(game, visitorOs)
  const visitorDownloadLink = getPrimaryDownloadLink(visitorDownloadPlatform)

  return (
    <article
      className="game-card"
      style={{ '--accent': game.accent } as CSSProperties}
    >
      <div className="game-card__header">
        <div>
          <p className="game-card__genre">{game.genreLabel}</p>
          <h3>
            <Link to={`/games/${game.slug}`} className="game-card__title-link">
              {game.title}
            </Link>
          </h3>
        </div>
        <span className="badge badge--accent">
          {downloadCount} download{downloadCount === 1 ? '' : 's'}
        </span>
      </div>

      <p className="game-card__highlight">{game.highlight}</p>

      <p className="game-card__summary">
        {preferredPlatform?.summary ?? 'Bekijk de detailpagina voor platforminformatie.'}
      </p>

      <div className="platform-row">
        {game.platforms.map((platform) => (
          <span
            key={platform.os}
            className={`platform-pill platform-pill--${platform.mode}`}
          >
            <img
              src={osMeta[platform.os].icon}
              alt=""
              aria-hidden="true"
              className="platform-pill__icon"
            />
            <strong>{osMeta[platform.os].label}</strong>
            <small>{getStatusCopy(platform)}</small>
          </span>
        ))}
      </div>

      <div className="game-card__meta">
        <span>{game.platforms.length} platform{game.platforms.length === 1 ? '' : 's'}</span>
        <span>{game.sources.length} bron{game.sources.length > 1 ? 'nen' : ''}</span>
      </div>

      <div className="game-card__actions">
        {visitorDownloadPlatform && visitorDownloadLink ? (
          <a
            className="button"
            href={toHref(visitorDownloadLink.href)}
            download=""
          >
            Download
          </a>
        ) : null}

        <Link className="button button--ghost" to={`/games/${game.slug}`}>
          Bekijk details
        </Link>
      </div>
    </article>
  )
}
