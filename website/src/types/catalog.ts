export type OperatingSystem = 'windows' | 'mac' | 'linux'

export type OperatingSystemFilter = OperatingSystem | 'all'

export type PlatformMode = 'download' | 'info'

export interface PlatformLink {
  label: string
  href: string
  kind: 'download' | 'external'
  description: string
}

export interface PlatformDetails {
  os: OperatingSystem
  mode: PlatformMode
  summary: string
  note?: string
  installSteps: string[]
  links: PlatformLink[]
}

export interface InstructionVideo {
  os: OperatingSystem
  href: string
}

export interface GameServer {
  /** Name shown in the game's server list / greeting. */
  name: string
  /** Fixed host name; when omitted, the host the visitor used to open this site. */
  host?: string
  /** Omit when it is the game's default port, so players only type the host. */
  port?: number
  /** Client version players need to be able to join. */
  clientVersion: string
  summary: string
  joinSteps: string[]
  rules: string[]
  /** Subdomain of the live dashboard, e.g. 'rct2' -> rct2.lan / rct2.localhost. */
  dashboardSubdomain?: string
}

export interface GameEntry {
  slug: string
  title: string
  genreLabel: string
  highlight: string
  descriptionNl: string
  setupNote: string
  keywords: string[]
  accent: string
  platforms: PlatformDetails[]
  videos?: InstructionVideo[]
  server?: GameServer
}
