import { Link } from 'react-router-dom'
import {
  getTournamentUrl,
  useTournamentAvailabilityContext,
} from '../features/tournament/availability'

function formatTournamentLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export function TournamentHubPage() {
  const tournamentAvailability = useTournamentAvailabilityContext()

  if (tournamentAvailability.loading) {
    return (
      <div className="page-stack">
        <section className="empty-state empty-state--page">
          <p className="section-kicker">Tournament hub</p>
          <h1>Toernooien laden</h1>
          <p>De koppeling met `tournament.lan` wordt opgehaald.</p>
        </section>
      </div>
    )
  }

  if (!tournamentAvailability.available) {
    return (
      <div className="page-stack">
        <section className="empty-state empty-state--page">
          <p className="section-kicker">Tournament hub</p>
          <h1>Geen publieke tournaments zichtbaar</h1>
          <p>
            Zodra er een publiek tournament bestaat op `tournament.lan`, verschijnt de link
            automatisch weer in de site.
          </p>
          <Link className="button" to="/">
            Terug naar downloads
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div className="page-stack">
      <section className="detail-hero">
        <Link className="back-link" to="/">
          Terug naar downloads
        </Link>

        <p className="section-kicker">Tournament hub</p>
        <h1>Tournament overzicht</h1>
        <p className="detail-hero__lead">
          Gebruik de ingebouwde weergave om snel heen en weer te schakelen tussen downloads
          en toernooien.
        </p>

        <div className="detail-hero__actions">
          <a className="button" href="#tournament-frame">
            Bekijk in deze pagina
          </a>
          <a className="button button--ghost" href={getTournamentUrl()} target="_blank" rel="noreferrer">
            Open tournament.lan
          </a>
        </div>
      </section>

      <section className="detail-grid">
        {tournamentAvailability.tournaments.map((tournament) => (
          <article key={tournament.id} className="surface-panel tournament-summary-card">
            <div>
              <p className="section-kicker">{formatTournamentLabel(tournament.status)}</p>
              <h2>{tournament.name}</h2>
            </div>

            <p>{tournament.description || 'Open het tournament voor brackets, standen en wedstrijdinformatie.'}</p>

            <div className="tournament-meta">
              <span>{tournament.participant_count} deelnemers</span>
              <span>{formatTournamentLabel(tournament.format)}</span>
              <span>{tournament.current_round_name ?? 'Klaar om te starten'}</span>
            </div>

            <div className="hero-panel__actions">
              <a
                className="button"
                href={getTournamentUrl(`/tournaments/${tournament.slug}`)}
                target="_blank"
                rel="noreferrer"
              >
                Open overzicht
              </a>
              <a
                className="button button--ghost"
                href={getTournamentUrl(`/dashboard/${tournament.slug}/tv`)}
                target="_blank"
                rel="noreferrer"
              >
                Open TV mode
              </a>
            </div>
          </article>
        ))}
      </section>

      <section className="surface-panel" id="tournament-frame">
        <div className="surface-panel__header">
          <div>
            <p className="section-kicker">Ingebouwde weergave</p>
          </div>
        </div>

        <div className="tournament-frame-shell">
          <iframe
            className="tournament-frame"
            src={getTournamentUrl()}
            title="PodiumForge tournament hub"
            loading="lazy"
            allowFullScreen
          />
        </div>
      </section>
    </div>
  )
}
