import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { GameCard } from '../components/GameCard'
import { MarioStage } from '../components/MarioStage'
import { OsFilter } from '../components/OsFilter'
import { games } from '../data/games'
import {
  getTournamentUrl,
  useTournamentAvailabilityContext,
} from '../features/tournament/availability'
import type { OperatingSystemFilter } from '../types/catalog'
import { hasPlatform, osLabels } from '../utils/catalog'

export function HomePage() {
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<OperatingSystemFilter>('all')
  const tournamentAvailability = useTournamentAvailabilityContext()

  const filteredGames = useMemo(() => {
    const query = search.trim().toLowerCase()

    return games.filter((game) => {
      const matchesFilter =
        activeFilter === 'all' ? true : hasPlatform(game, activeFilter)

      const haystack = [
        game.title,
        game.genreLabel,
        game.highlight,
        game.descriptionNl,
        ...game.keywords,
      ]
        .join(' ')
        .toLowerCase()

      const matchesQuery = query.length === 0 || haystack.includes(query)

      return matchesFilter && matchesQuery
    })
  }, [activeFilter, search])

  const activeLabel =
    activeFilter === 'all' ? 'de volledige bibliotheek' : osLabels[activeFilter]
  const featuredTournaments = tournamentAvailability.tournaments.slice(0, 3)

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div className="hero-panel__copy">
          <p className="section-kicker">GAME LAN PARTY</p>
          <h1>Download station voor het hele LAN-weekend</h1>
          <p className="hero-panel__lead">
            Alle lokale downloads uit de voorbereidingsmap staan hier per game
            gegroepeerd, inclusief installatiehulp, genre-uitleg en losse extra
            bestanden zoals README&apos;s, datafiles en runtime-installers.
          </p>
        </div>
      </section>

      {tournamentAvailability.available ? (
        <section className="surface-panel tournament-callout">
          <div className="surface-panel__header">
            <div>
              <p className="section-kicker">Live tournament hub</p>
              <h2>Brackets, standings en TV-mode staan klaar</h2>
            </div>
            <span className="badge badge--info">
              {tournamentAvailability.tournaments.length} toernooi
              {tournamentAvailability.tournaments.length === 1 ? '' : 'en'}
            </span>
          </div>

          <p className="surface-panel__note">
            Open de ingebouwde tournament-weergave om snel terug te springen naar de
            downloads, of zet `tournament.lan` op een los scherm voor presentatie en
            beheer.
          </p>

          <div className="tournament-pill-row">
            {featuredTournaments.map((tournament) => (
              <span key={tournament.slug} className="platform-pill platform-pill--info">
                <strong>{tournament.name}</strong>
                <small>{tournament.current_round_name ?? 'Klaar om te starten'}</small>
              </span>
            ))}
          </div>

          <div className="hero-panel__actions">
            <Link className="button" to="/tournament">
              Open in website
            </Link>
            <a
              className="button button--ghost"
              href={getTournamentUrl()}
              target="_blank"
              rel="noreferrer"
            >
              Open tournament.lan
            </a>
          </div>
        </section>
      ) : null}

      <MarioStage />

      <section className="surface-panel" id="catalogus">
        <div className="surface-panel__header">
          <div>
            <p className="section-kicker">Filter en zoek</p>
            <h2>Kies je platform en game</h2>
          </div>
          <p className="surface-panel__note">
            Ook extra bestanden zoals README&apos;s, data-zips en losse installers zijn per
            platform zichtbaar.
          </p>
        </div>

        <div className="toolbar">
          <label className="search-field">
            <span>Zoeken</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Zoek op titel, genre of trefwoord"
            />
          </label>

          <OsFilter value={activeFilter} onChange={setActiveFilter} />
        </div>

        <div className="results-head">
          <p>
            {filteredGames.length} resultaat
            {filteredGames.length === 1 ? '' : 'en'} voor <strong>{activeLabel}</strong>.
          </p>
        </div>

        {filteredGames.length > 0 ? (
          <div className="games-grid">
            {filteredGames.map((game) => (
              <GameCard key={game.slug} game={game} activeFilter={activeFilter} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p className="section-kicker">Geen matches</p>
            <h3>Niets gevonden voor deze combinatie</h3>
            <p>Probeer een andere zoekterm of zet het platformfilter terug op Alles.</p>
            <button
              type="button"
              className="button"
              onClick={() => {
                setSearch('')
                setActiveFilter('all')
              }}
            >
              Reset filters
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
