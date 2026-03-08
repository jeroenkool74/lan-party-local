import { Link } from 'react-router-dom'

interface NotFoundPageProps {
  title?: string
  message?: string
}

export function NotFoundPage({
  title = 'Pagina niet gevonden',
  message = 'Deze route hoort niet bij de huidige site.',
}: NotFoundPageProps) {
  return (
    <section className="empty-state empty-state--page">
      <p className="section-kicker">404</p>
      <h1>{title}</h1>
      <p>{message}</p>
      <Link className="button" to="/">
        Terug naar het overzicht
      </Link>
    </section>
  )
}
