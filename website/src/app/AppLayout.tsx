import { Link, NavLink, Outlet } from 'react-router-dom'
import { ScrollToTop } from '../components/ScrollToTop'
import {
  TournamentAvailabilityContext,
  useTournamentAvailability,
} from '../features/tournament/availability'

export function AppLayout() {
  const tournamentAvailability = useTournamentAvailability()

  return (
    <TournamentAvailabilityContext.Provider value={tournamentAvailability}>
      <div className="site-shell">
        <ScrollToTop />

        <header className="site-header">
          <div className="site-header__inner">
            <Link className="site-brand" to="/">
              <span className="site-brand__kicker">27 t/m 29 maart 2026</span>
              <strong className="site-brand__name">GAME LAN PARTY</strong>
            </Link>

            <nav className="site-nav" aria-label="Hoofdnavigatie">
              <NavLink to="/" end>
                Downloads
              </NavLink>
              {tournamentAvailability.available ? (
                <NavLink to="/tournament">Tournament</NavLink>
              ) : null}
            </nav>
          </div>
        </header>

        <main className="site-main">
          <Outlet />
        </main>

        <footer className="site-footer">
          <div className="site-footer__inner">
            <p>Veel pleziek op de LAN-party!</p>
          </div>
        </footer>
      </div>
    </TournamentAvailabilityContext.Provider>
  )
}
