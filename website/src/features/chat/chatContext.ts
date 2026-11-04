import { createContext, useContext } from 'react'
import type { IrcSession, IrcState } from './ircSession'

export interface ChatContextValue {
  /** Staat de chat aan (via CHAT_ENABLED in docker-compose)? */
  enabled: boolean
  session: IrcSession
  state: IrcState
  nick: string
  isOpen: boolean
  draft: string
  setDraft: (draft: string) => void
  open: (options?: { channel?: string; draft?: string }) => void
  close: () => void
  connect: (nick: string) => void
  disconnect: () => void
}

export const ChatContext = createContext<ChatContextValue | null>(null)

export function useChat() {
  return useContext(ChatContext)
}
