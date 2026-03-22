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
}
