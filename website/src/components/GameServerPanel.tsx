import { useState } from 'react'
import type { GameServer } from '../types/catalog'

interface GameServerPanelProps {
  gameTitle: string
  server: GameServer
}

function isLocalhost(hostname: string) {
  return hostname === 'localhost' || hostname.endsWith('.localhost')
}

// The game server runs on the same machine as this website, so the host the
// visitor used to reach the site (download.lan, localhost, an IP) also works
// in the game client.
function getServerHost() {
  if (typeof window === 'undefined' || !window.location.hostname) {
    return 'download.lan'
  }
  return window.location.hostname
}

function getDashboardHref(subdomain: string) {
  const hostname = typeof window === 'undefined' ? '' : window.location.hostname
  return isLocalhost(hostname)
    ? `http://${subdomain}.localhost`
    : `http://${subdomain}.lan`
}

export function GameServerPanel({ gameTitle, server }: GameServerPanelProps) {
  const host = server.host ?? getServerHost()
  const address = server.port ? `${host}:${server.port}` : host
  const dashboardHref = server.dashboardSubdomain
    ? getDashboardHref(server.dashboardSubdomain)
    : undefined
  const [copied, setCopied] = useState(false)

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard needs a secure context; plain http on the LAN may refuse.
      setCopied(false)
    }
  }

  return (
    <section className="surface-panel game-server" id="server">
      <div className="surface-panel__header">
        <div>
          <p className="section-kicker">Samen spelen op de LAN</p>
          <h2>Speel mee op de server: {server.name}</h2>
        </div>
      </div>

      <p className="game-server__summary">{server.summary}</p>

      <div className="game-server__address">
        <span>Serveradres</span>
        <code>{address}</code>
        {typeof navigator !== 'undefined' && navigator.clipboard ? (
          <button
            className="button button--ghost"
            type="button"
            onClick={copyAddress}
          >
            {copied ? 'Gekopieerd!' : 'Kopieer'}
          </button>
        ) : null}
        <small>
          {gameTitle} versie {server.clientVersion}
        </small>
      </div>

      <div className="detail-grid">
        <article>
          <h3>Zo doe je mee</h3>
          <ol className="step-list">
            {server.joinSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </article>

        <article>
          <h3>Spelregels</h3>
          <ul className="step-list">
            {server.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </article>
      </div>

      {dashboardHref ? (
        <div className="game-server__dashboard">
          <p>
            Benieuwd wie er wint? Op het live scorebord zie je wie het meeste
            geld, de meeste bezoekers en de beste attracties heeft.
          </p>
          <a className="button" href={dashboardHref} target="_blank" rel="noreferrer">
            Bekijk het live scorebord
          </a>
        </div>
      ) : null}
    </section>
  )
}
