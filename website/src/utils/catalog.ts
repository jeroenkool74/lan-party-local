import { games } from '../data/games'
import type {
  GameEntry,
  OperatingSystem,
  OperatingSystemFilter,
  PlatformDetails,
  PlatformLink,
} from '../types/catalog'

export const osMeta: Record<
  OperatingSystem,
  { label: string; icon: string }
> = {
  windows: { label: 'Windows', icon: '/platforms/windows.svg' },
  mac: { label: 'macOS', icon: '/platforms/apple.svg' },
  linux: { label: 'Linux', icon: '/platforms/linux.svg' },
}

export const osLabels: Record<OperatingSystem, string> = {
  windows: osMeta.windows.label,
  mac: osMeta.mac.label,
  linux: osMeta.linux.label,
}

export function getGameBySlug(slug: string) {
  return games.find((game) => game.slug === slug)
}

export function getPlatform(game: GameEntry, os: OperatingSystem) {
  return game.platforms.find((platform) => platform.os === os)
}

export function getVisitorOs(): OperatingSystem | undefined {
  if (typeof navigator === 'undefined') {
    return undefined
  }

  const nav = navigator as Navigator & {
    userAgentData?: {
      platform?: string
    }
  }
  const userAgent = navigator.userAgent.toLowerCase()
  const platform = navigator.platform.toLowerCase()
  const userAgentDataPlatform = nav.userAgentData?.platform?.toLowerCase()
  const signature = `${userAgent} ${platform} ${userAgentDataPlatform ?? ''}`

  if (signature.includes('win')) {
    return 'windows'
  }

  if (
    signature.includes('mac') ||
    signature.includes('iphone') ||
    signature.includes('ipad') ||
    signature.includes('ipod')
  ) {
    return 'mac'
  }

  if (signature.includes('linux') || signature.includes('x11')) {
    return 'linux'
  }

  return undefined
}

export function hasPlatform(game: GameEntry, os: OperatingSystem) {
  return Boolean(getPlatform(game, os))
}

export function getPreferredPlatform(
  game: GameEntry,
  filter: OperatingSystemFilter,
) {
  if (filter !== 'all') {
    return getPlatform(game, filter)
  }

  return getPlatform(game, 'windows') ?? game.platforms[0]
}

export function countGamesForFilter(filter: OperatingSystemFilter) {
  if (filter === 'all') {
    return games.length
  }

  return games.filter((game) => hasPlatform(game, filter)).length
}

export function countGamesWithOtherSystemInfo() {
  return games.filter(
    (game) => hasPlatform(game, 'mac') || hasPlatform(game, 'linux'),
  ).length
}

export function countDirectDownloads(game: GameEntry) {
  return game.platforms.reduce((count, platform) => {
    return count + platform.links.filter((link) => link.kind === 'download').length
  }, 0)
}

export function countExternalInfo(game: GameEntry) {
  return game.platforms.reduce((count, platform) => {
    return count + platform.links.filter((link) => link.kind === 'external').length
  }, 0)
}

export function isExternalHref(href: string) {
  return /^https?:\/\//.test(href)
}

export function toHref(href: string) {
  return isExternalHref(href) ? href : encodeURI(href)
}

export function getPrimaryLink(platform?: PlatformDetails) {
  if (!platform) {
    return undefined
  }

  return platform.links[0]
}

export function getPrimaryDownloadLink(platform?: PlatformDetails) {
  if (!platform || platform.mode !== 'download') {
    return undefined
  }

  return platform.links.find((link) => link.kind === 'download')
}

export function getVisitorDownloadPlatform(
  game: GameEntry,
  visitorOs?: OperatingSystem,
) {
  if (!visitorOs) {
    return undefined
  }

  const platform = getPlatform(game, visitorOs)

  if (!platform || platform.mode !== 'download') {
    return undefined
  }

  return platform
}

export function getPrimaryDownload(game: GameEntry) {
  const windowsPlatform = getPlatform(game, 'windows')

  return windowsPlatform?.links.find((link) => link.kind === 'download')
}

export function getPrimaryExternalInfo(game: GameEntry) {
  for (const os of ['mac', 'linux'] as OperatingSystem[]) {
    const platform = getPlatform(game, os)

    if (!platform) {
      continue
    }

    const infoLink = platform.links.find((link) => link.kind === 'external')

    if (infoLink) {
      return infoLink
    }
  }

  return undefined
}

export function getStatusCopy(platform: PlatformDetails) {
  if (platform.mode === 'download') {
    return 'Directe download'
  }

  return 'Alleen info'
}

export function getActionLabel(platform: PlatformDetails, link?: PlatformLink) {
  if (!platform || !link) {
    return 'Bekijk details'
  }

  if (link.kind === 'download') {
    return `Download ${osLabels[platform.os]}`
  }

  return `Info voor ${osLabels[platform.os]}`
}
