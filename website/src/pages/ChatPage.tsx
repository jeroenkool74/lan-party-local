import { useState, type CSSProperties } from 'react'
import { NotFoundPage } from './NotFoundPage'
import { useChat } from '../features/chat/chatContext'
import { CHANNEL_DESCRIPTIONS, DEFAULT_CHANNELS } from '../features/chat/ircSession'
import { getVisitorOs, osMeta } from '../utils/catalog'
import type { OperatingSystem } from '../types/catalog'

interface ChatClient {
  name: string
  description: string
  localHref: string
  externalHref: string
  steps: string[]
}

const IRC_PORT = 6667

function getServerHost() {
  return typeof window === 'undefined' ? 'home.lan' : window.location.hostname
}

const halloySteps = [
  'Installeer en start Halloy; open via het menu de configuratiemap (config.toml).',
  'Plak de configuratie hieronder in config.toml, vul je eigen naam in en sla op.',
  'Halloy laadt de configuratie opnieuw en verbindt automatisch met #lan en #hulp.',
]

const hexchatSteps = (host: string) => [
  'Installeer en start HexChat.',
  'Klik in de netwerklijst op "Add", noem het netwerk "LAN-party" en klik op "Edit".',
  `Vervang de server door ${host}/${IRC_PORT} en zet "Use SSL" uit.`,
  `Zet bij "Favorite channels" ${DEFAULT_CHANNELS.join(',')} en klik op "Connect".`,
]

function getClients(os: OperatingSystem, host: string): ChatClient[] {
  const folder = { windows: 'Windows', mac: 'Mac', linux: 'Linux' }[os]
  const halloy: ChatClient = {
    name: 'Halloy',
    description: 'Moderne, gratis IRC-client die op Windows, macOS en Linux hetzelfde werkt.',
    localHref: `/downloads/Chat/${folder}/`,
    externalHref: 'https://github.com/squidowl/halloy/releases/latest',
    steps: halloySteps,
  }
  const hexchat: ChatClient = {
    name: 'HexChat',
    description:
      'Klassieke IRC-client met een simpel instelscherm. Wordt niet meer doorontwikkeld, maar werkt prima.',
    localHref: `/downloads/Chat/${folder}/`,
    externalHref: 'https://hexchat.github.io/downloads.html',
    steps: hexchatSteps(host),
  }
  return os === 'mac' ? [halloy] : [halloy, hexchat]
}

const operatingSystems: OperatingSystem[] = ['windows', 'mac', 'linux']

export function ChatPage() {
  const chat = useChat()
  const host = getServerHost()
  const [selectedOs, setSelectedOs] = useState<OperatingSystem>(() => getVisitorOs() ?? 'windows')
  const [copied, setCopied] = useState(false)

  if (!chat?.enabled) {
    return (
      <NotFoundPage title="Chat staat uit" message="De chat is op dit moment niet beschikbaar." />
    )
  }

  const halloyConfig = `[servers.lan]
nickname = "${chat.state.nick || chat.nick || 'JouwNaam'}"
server = "${host}"
port = ${IRC_PORT}
use_tls = false
channels = [${DEFAULT_CHANNELS.map((channel) => `"${channel}"`).join(', ')}]`

  function copyConfig() {
    void navigator.clipboard?.writeText(halloyConfig).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="page-stack">
      <section className="detail-hero" style={{ '--accent': '#3da34f' } as CSSProperties}>
        <p className="section-kicker">Chat</p>
        <h1>LAN chat</h1>
        <p className="detail-hero__lead">
          Kletsen met de rest van de zaal, teams zoeken of hulp vragen bij het installeren van een
          game? Dat kan direct hier op de website, of met een eigen chatprogramma (IRC-client).
        </p>
        <div className="detail-hero__actions">
          <button className="button" type="button" onClick={() => chat.open({ channel: '#lan' })}>
            Open de webchat
          </button>
          <button
            className="button button--ghost"
            type="button"
            onClick={() => chat.open({ channel: '#hulp' })}
          >
            Stel een vraag in #hulp
          </button>
        </div>
      </section>

      <section className="detail-grid">
        <article className="surface-panel surface-panel--compact">
          <p className="section-kicker">Kanalen</p>
          <h2>Waar praat je over?</h2>
          <ul className="step-list">
            {DEFAULT_CHANNELS.map((channel) => (
              <li key={channel}>
                <strong>{channel}</strong>: {CHANNEL_DESCRIPTIONS[channel]}
              </li>
            ))}
            <li>
              Eigen kanaal nodig voor je team? Typ <code>/join #teamnaam</code>.
            </li>
          </ul>
          <p className="surface-panel__note">
            Kom je later binnen? Je ziet dan de laatste 50 berichten van een kanaal, ook in HexChat
            of Halloy. Privéberichten worden niet bewaard.
          </p>
        </article>

        <article className="surface-panel surface-panel--compact">
          <p className="section-kicker">Verbindingsgegevens</p>
          <h2>Eigen IRC-client</h2>
          <dl className="chat-server-info">
            <dt>Server</dt>
            <dd>
              <code>{host}</code>
            </dd>
            <dt>Poort</dt>
            <dd>
              <code>{IRC_PORT}</code> (geen SSL/TLS)
            </dd>
            <dt>Kanalen</dt>
            <dd>
              <code>{DEFAULT_CHANNELS.join(' ')}</code>
            </dd>
          </dl>
          <p className="surface-panel__note">
            Handige commando's: <code>/me zwaait</code>, <code>/nick NieuweNaam</code>,{' '}
            <code>/msg naam bericht</code>.
          </p>
        </article>
      </section>

      <section className="surface-panel">
        <div className="surface-panel__header">
          <div>
            <p className="section-kicker">Downloads</p>
            <h2>Chatprogramma per platform</h2>
          </div>
        </div>

        <div className="filter-chips chat-os-chips">
          {operatingSystems.map((os) => (
            <button
              key={os}
              type="button"
              className={`filter-chip${os === selectedOs ? ' filter-chip--active' : ''}`}
              onClick={() => setSelectedOs(os)}
            >
              <span>{osMeta[os].label}</span>
            </button>
          ))}
        </div>

        <div className="platform-grid">
          {getClients(selectedOs, host).map((client) => (
            <article key={client.name} className="platform-card">
              <div className="platform-card__header">
                <div>
                  <p className="section-kicker">{osMeta[selectedOs].label}</p>
                  <h3>{client.name}</h3>
                </div>
              </div>
              <p className="platform-card__summary">{client.description}</p>
              <div className="platform-card__links">
                <a className="button" href={client.localHref}>
                  Lokale download
                </a>
                <a
                  className="button button--ghost"
                  href={client.externalHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  Officiële site
                </a>
              </div>
              <ol className="step-list">
                {client.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {client.name === 'Halloy' ? (
                <div className="chat-config">
                  <pre>{halloyConfig}</pre>
                  <button className="button button--ghost" type="button" onClick={copyConfig}>
                    {copied ? 'Gekopieerd!' : 'Kopieer configuratie'}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
