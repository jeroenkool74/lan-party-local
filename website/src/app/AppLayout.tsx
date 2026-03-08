import { Link, NavLink, Outlet } from 'react-router-dom'
import { ScrollToTop } from '../components/ScrollToTop'

export function AppLayout() {
  return (
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
          </nav>
        </div>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <p>Alle lokale bestanden uit `/downloads/` zijn hier per game gegroepeerd.</p>
          <p>De stijl volgt de flyer en de LAN-site van lan.jancampertgroep.nl.</p>
        </div>
      </footer>
    </div>
  )
}
