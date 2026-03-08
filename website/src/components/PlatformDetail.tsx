import { getStatusCopy, osMeta, toHref } from '../utils/catalog'
import type { PlatformDetails } from '../types/catalog'

interface PlatformDetailProps {
  platform: PlatformDetails
}

export function PlatformDetail({ platform }: PlatformDetailProps) {
  const linkCount = platform.links.length

  return (
    <article className="platform-card">
      <div className="platform-card__header">
        <div>
          <p className="section-kicker">{osMeta[platform.os].label}</p>
          <h3>{getStatusCopy(platform)}</h3>
        </div>
        <span className={`badge badge--${platform.mode}`}>
          {linkCount} link{linkCount === 1 ? '' : 's'}
        </span>
      </div>

      <p className="platform-card__summary">{platform.summary}</p>

      {platform.note ? <p className="platform-card__note">{platform.note}</p> : null}

      <ul className="download-list">
        {platform.links.map((link) => (
          <li key={`${platform.os}-${link.href}`} className="download-list__item">
            <a
              className={`button${link.kind === 'external' ? ' button--ghost' : ''}`}
              href={toHref(link.href)}
              download={link.kind === 'download' ? '' : undefined}
              target={link.kind === 'external' ? '_blank' : undefined}
              rel={link.kind === 'external' ? 'noreferrer' : undefined}
            >
              {link.label}
            </a>
            <p>{link.description}</p>
          </li>
        ))}
      </ul>

      <ol className="step-list">
        {platform.installSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </article>
  )
}
