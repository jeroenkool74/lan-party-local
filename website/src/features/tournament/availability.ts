import { createContext, useContext, useEffect, useState } from 'react'

export interface TournamentSummary {
  id: string
  name: string
  slug: string
  description: string
  format: string
  status: string
  participant_count: number
  current_round_name: string | null
}

export interface TournamentAvailabilityState {
  loading: boolean
  available: boolean
  tournaments: TournamentSummary[]
}

const TOURNAMENT_HOST = 'tournament.lan'

const defaultAvailabilityState: TournamentAvailabilityState = {
  loading: true,
  available: false,
  tournaments: [],
}

export const TournamentAvailabilityContext =
  createContext<TournamentAvailabilityState>(defaultAvailabilityState)

export function getTournamentOrigin() {
  if (typeof window === 'undefined') {
    return `http://${TOURNAMENT_HOST}`
  }

  return `${window.location.protocol}//${TOURNAMENT_HOST}`
}

export function getTournamentUrl(path = '') {
  const normalizedPath = path.replace(/^\//, '')
  return new URL(normalizedPath, `${getTournamentOrigin()}/`).toString()
}

export function useTournamentAvailability() {
  const [state, setState] = useState<TournamentAvailabilityState>(defaultAvailabilityState)

  useEffect(() => {
    const controller = new AbortController()

    async function loadTournaments() {
      try {
        const response = await fetch(getTournamentUrl('/api/v1/public/tournaments'), {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Tournament API unavailable')
        }

        const tournaments = (await response.json()) as TournamentSummary[]

        setState({
          loading: false,
          available: Array.isArray(tournaments) && tournaments.length > 0,
          tournaments: Array.isArray(tournaments) ? tournaments : [],
        })
      } catch {
        if (controller.signal.aborted) {
          return
        }

        setState({
          loading: false,
          available: false,
          tournaments: [],
        })
      }
    }

    void loadTournaments()

    const refreshInterval = window.setInterval(() => {
      void loadTournaments()
    }, 30000)

    return () => {
      controller.abort()
      window.clearInterval(refreshInterval)
    }
  }, [])

  return state
}

export function useTournamentAvailabilityContext() {
  return useContext(TournamentAvailabilityContext)
}
