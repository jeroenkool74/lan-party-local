import { Link, NavLink, Outlet } from 'react-router-dom'
import { ScrollToTop } from '../components/ScrollToTop'
import { ChatProvider } from '../features/chat/ChatProvider'
import { ChatWidget } from '../features/chat/ChatWidget'
import { useChat } from '../features/chat/chatContext'
import {
  TournamentAvailabilityContext,
  useTournamentAvailability,
} from '../features/tournament/availability'

export function AppLayout() {
  const tournamentAvailability = useTournamentAvailability()

  return (
    <TournamentAvailabilityContext.Provider value={tournamentAvailability}>
      <ChatProvider>
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
                <ChatNavLink />
              </nav>
            </div>
          </header>

          <main className="site-main">
            <Outlet />
          </main>

          <footer className="site-footer">
            <div className="site-footer__inner">
              <p>Veel pleziek op de LAN-party!</p>
              <p className="site-footer__aside">
                Kan een instructievideo beter?{' '}
                <Link to="/video-insturen">Neem zelf een video op</Link>.
              </p>
            </div>
          </footer>
          <ChatWidget />
        </div>
      </ChatProvider>
    </TournamentAvailabilityContext.Provider>
  )
}

function ChatNavLink() {
  const chat = useChat()
  return chat?.enabled ? <NavLink to="/chat">Chat</NavLink> : null
}
