import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { ChatContext, type ChatContextValue } from './chatContext'
import { IrcSession, sanitizeNick } from './ircSession'
import { useSiteConfig } from './siteConfig'

const NICK_STORAGE_KEY = 'lan-chat-nick'
const AUTOCONNECT_STORAGE_KEY = 'lan-chat-autoconnect'

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) {
      window.localStorage.removeItem(key)
    } else {
      window.localStorage.setItem(key, value)
    }
  } catch {
    // localStorage niet beschikbaar: dan maar niet onthouden.
  }
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { chatEnabled } = useSiteConfig()
  const [session] = useState(() => new IrcSession())
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const [nick, setNick] = useState(() => readStorage(NICK_STORAGE_KEY))
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState('')

  // Wie eerder verbonden was, wordt bij het laden van de pagina automatisch weer verbonden.
  useEffect(() => {
    if (!chatEnabled) {
      return
    }
    const storedNick = readStorage(NICK_STORAGE_KEY)
    if (storedNick && readStorage(AUTOCONNECT_STORAGE_KEY) === 'true') {
      session.connect(storedNick)
    }
    return () => session.disconnect()
  }, [chatEnabled, session])

  useEffect(() => {
    session.setVisible(isOpen)
  }, [isOpen, session])

  // Nick bijwerken als de server hem verandert (bv. door /nick of een dubbele naam).
  useEffect(() => {
    if (state.nick) {
      writeStorage(NICK_STORAGE_KEY, state.nick)
    }
  }, [state.nick])

  const connect = useCallback(
    (input: string) => {
      const cleanNick = sanitizeNick(input)
      if (!cleanNick) {
        return
      }
      setNick(cleanNick)
      writeStorage(NICK_STORAGE_KEY, cleanNick)
      writeStorage(AUTOCONNECT_STORAGE_KEY, 'true')
      session.connect(cleanNick)
    },
    [session],
  )

  const disconnect = useCallback(() => {
    writeStorage(AUTOCONNECT_STORAGE_KEY, null)
    session.disconnect()
  }, [session])

  const open = useCallback<ChatContextValue['open']>(
    (options) => {
      setIsOpen(true)
      if (options?.channel) {
        session.openConversation(options.channel)
      }
      if (options?.draft !== undefined) {
        setDraft(options.draft)
      }
    },
    [session],
  )

  const close = useCallback(() => setIsOpen(false), [])

  const value = useMemo<ChatContextValue>(
    () => ({
      enabled: chatEnabled,
      session,
      state,
      nick,
      isOpen,
      draft,
      setDraft,
      open,
      close,
      connect,
      disconnect,
    }),
    [chatEnabled, session, state, nick, isOpen, draft, open, close, connect, disconnect],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
