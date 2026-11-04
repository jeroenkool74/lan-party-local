import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { InstructionVideos } from '../components/InstructionVideos'
import { PlatformDetail } from '../components/PlatformDetail'
import { useChat } from '../features/chat/chatContext'
import { NotFoundPage } from './NotFoundPage'
import {
  getGameBySlug,
  getPrimaryDownloadLink,
  getStatusCopy,
  getVisitorDownloadPlatform,
  getVisitorOs,
  osMeta,
  toHref,
} from '../utils/catalog'

export function GamePage() {
  const { slug } = useParams()
  const chat = useChat()
  const game = slug ? getGameBySlug(slug) : undefined

  if (!game) {
    return (
      <NotFoundPage
        title="Spel niet gevonden"
        message="Deze detailpagina bestaat niet of hoort niet meer bij de huidige catalogus."
      />
    )
  }

  const visitorOs = getVisitorOs()
  const visitorDownloadPlatform = getVisitorDownloadPlatform(game, visitorOs)
  const visitorDownload = getPrimaryDownloadLink(visitorDownloadPlatform)

  return (
    <div className="page-stack">
      <section
        className="detail-hero"
        style={{ '--accent': game.accent } as CSSProperties}
      >
        <Link className="back-link" to="/">
          Terug naar overzicht
        </Link>

        <p className="section-kicker">{game.genreLabel}</p>
        <h1>{game.title}</h1>
        <p className="detail-hero__lead">{game.descriptionNl}</p>

        <div className="detail-hero__actions">
          {visitorDownload ? (
            <a
              className="button"
              href={toHref(visitorDownload.href)}
              download=""
            >
              Download
            </a>
          ) : null}

          <a className="button button--ghost" href="#downloads">
            Bekijk alle bestanden
          </a>

          {game.videos?.length ? (
            <a className="button button--ghost" href="#instructievideo">
              Bekijk instructievideo
            </a>
          ) : null}

          {chat?.enabled ? (
            <button
              className="button button--ghost"
              type="button"
              onClick={() =>
                chat.open({ channel: '#hulp', draft: `[${game.title}] ` })
              }
            >
              Vraag stellen in de chat
            </button>
          ) : null}
        </div>
      </section>

      <section className="detail-grid">
        <article className="surface-panel surface-panel--compact">
          <p className="section-kicker">Speltype</p>
          <h2>Wat voor spel is dit?</h2>
          <p>{game.highlight}</p>
          <p>{game.setupNote}</p>
        </article>

        <article className="surface-panel surface-panel--compact">
          <p className="section-kicker">Platformstatus</p>
          <h2>Beschikbaarheid</h2>
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
        </article>
      </section>

      {game.videos?.length ? (
        <InstructionVideos
          key={game.slug}
          videos={game.videos}
          visitorOs={visitorOs}
        />
      ) : null}

      <section className="surface-panel" id="downloads">
        <div className="surface-panel__header">
          <div>
            <p className="section-kicker">Downloads & installatie</p>
            <h2>Alle lokale bestanden per platform</h2>
          </div>
        </div>

        <div className="platform-grid">
          {game.platforms.map((platform) => (
            <PlatformDetail key={platform.os} platform={platform} />
          ))}
        </div>
      </section>
    </div>
  )
}
