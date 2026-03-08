import { osChoices } from '../data/games'
import { countGamesForFilter } from '../utils/catalog'
import type { OperatingSystemFilter } from '../types/catalog'

interface OsFilterProps {
  value: OperatingSystemFilter
  onChange: (value: OperatingSystemFilter) => void
}

export function OsFilter({ value, onChange }: OsFilterProps) {
  return (
    <div className="filter-chips" role="tablist" aria-label="Besturingssysteem filter">
      {osChoices.map((choice) => {
        const isActive = choice.id === value

        return (
          <button
            key={choice.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`filter-chip${isActive ? ' filter-chip--active' : ''}`}
            onClick={() => onChange(choice.id)}
          >
            <span>{choice.label}</span>
            <small>
              {countGamesForFilter(choice.id)} · {choice.blurb}
            </small>
          </button>
        )
      })}
    </div>
  )
}
