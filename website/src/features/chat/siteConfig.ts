import { useEffect, useState } from 'react'

interface SiteConfig {
  chatEnabled: boolean
}

/**
 * Leest /site-config.json, die nginx genereert uit de CHAT_ENABLED
 * environment-variabele. Tijdens `npm run dev` kun je VITE_CHAT_ENABLED=true zetten.
 */
export function useSiteConfig() {
  const [config, setConfig] = useState<SiteConfig>({
    chatEnabled: import.meta.env.VITE_CHAT_ENABLED === 'true',
  })

  useEffect(() => {
    const controller = new AbortController()
    fetch('/site-config.json', { cache: 'no-store', signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { chatEnabled?: string | boolean } | null) => {
        if (data && 'chatEnabled' in data) {
          setConfig({ chatEnabled: String(data.chatEnabled).toLowerCase() === 'true' })
        }
      })
      .catch(() => {
        // Geen config (bv. Vite dev-server): standaardwaarde houden.
      })
    return () => controller.abort()
  }, [])

  return config
}
