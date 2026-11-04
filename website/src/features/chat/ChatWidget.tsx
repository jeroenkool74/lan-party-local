import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { Link } from 'react-router-dom'
import { useChat } from './chatContext'
import { CHANNEL_DESCRIPTIONS, SERVER_TAB, sanitizeNick, type ChatMessage } from './ircSession'

const timeFormat = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' })

/** Vaste kleur per nickname, zodat je mensen makkelijk herkent. */
function nickColor(nick: string) {
  let hash = 0
  for (const char of nick.toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0
  }
  return `hsl(${Math.abs(hash) % 360} 65% 35%)`
}

function messageClass(message: ChatMessage, modifier = '') {
  return [
    'chat-message',
    modifier,
    message.mention && !message.history ? 'chat-message--mention' : '',
    message.history ? 'chat-message--history' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function MessageLine({ message }: { message: ChatMessage }) {
  const time = (
    <time className="chat-message__time" dateTime={new Date(message.time).toISOString()}>
      {timeFormat.format(message.time)}
    </time>
  )

  if (message.kind === 'message' || message.kind === 'notice') {
    return (
      <li className={messageClass(message)}>
        {time}
        {message.nick ? (
          <strong className="chat-message__nick" style={{ color: nickColor(message.nick) }}>
            {message.nick}
          </strong>
        ) : null}
        <span className="chat-message__text">{message.text}</span>
      </li>
    )
  }

  if (message.kind === 'action') {
    return (
      <li className={messageClass(message, 'chat-message--action')}>
        {time}
        <span className="chat-message__text">
          * <strong style={{ color: nickColor(message.nick ?? '') }}>{message.nick}</strong>{' '}
          {message.text}
        </span>
      </li>
    )
  }

  return (
    <li className="chat-message chat-message--event">
      {time}
      <span className="chat-message__text">{message.text}</span>
    </li>
  )
}

function NickForm() {
  const chat = useChat()!
  const [value, setValue] = useState(chat.nick)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    chat.connect(value)
  }

  return (
    <form className="chat-join" onSubmit={handleSubmit}>
      <p>
        Kies een naam om mee te chatten. Stel in <strong>#hulp</strong> je vragen over de games, of
        klets gezellig mee in <strong>#lan</strong>.
      </p>
      <label className="search-field">
        <span>Je naam</span>
        <input
          autoFocus
          maxLength={20}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Bijvoorbeeld: Mario"
        />
      </label>
      <button className="button" type="submit" disabled={!value.trim()}>
        Start met chatten
      </button>
      <p className="chat-join__hint">
        Liever een echte chat-app? <Link to="/chat">Download een IRC-client</Link>.
      </p>
    </form>
  )
}

/** Klein formulier om je naam te wijzigen terwijl je verbonden bent. */
function RenameForm({ onDone }: { onDone: () => void }) {
  const chat = useChat()!
  const currentNick = chat.state.nick
  const [value, setValue] = useState(currentNick)
  const [requested, setRequested] = useState<string | null>(null)

  // Klaar zodra de server de nieuwe naam heeft bevestigd.
  useEffect(() => {
    if (requested && currentNick === requested) {
      onDone()
    }
  }, [requested, currentNick, onDone])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const nick = sanitizeNick(value)
    if (nick === currentNick) {
      onDone()
      return
    }
    setRequested(nick || null)
    chat.session.changeNick(value, { quiet: true })
  }

  function handleCancel() {
    chat.session.clearNickError()
    onDone()
  }

  const preview = sanitizeNick(value)
  const error = chat.state.nickError

  return (
    <form className="chat-rename" onSubmit={handleSubmit}>
      <label htmlFor="chat-rename-input">Nieuwe naam</label>
      <div className="chat-rename__row">
        <input
          id="chat-rename-input"
          autoFocus
          maxLength={20}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            chat.session.clearNickError()
          }}
          onKeyDown={(event) => event.key === 'Escape' && handleCancel()}
        />
        <button className="button" type="submit" disabled={!preview}>
          Opslaan
        </button>
        <button className="chat-icon-button" type="button" onClick={handleCancel}>
          Annuleren
        </button>
      </div>
      {error ? (
        <p className="chat-rename__error" role="alert">
          {error}
        </p>
      ) : preview && preview !== value.trim() ? (
        <p className="chat-rename__hint">Wordt: {preview}</p>
      ) : null}
    </form>
  )
}

export function ChatWidget() {
  const chat = useChat()
  const listRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [showUsers, setShowUsers] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const stopRenaming = useCallback(() => setRenaming(false), [])

  const state = chat?.state
  const activeKey = state?.active.toLowerCase() ?? ''
  const conversation = state?.conversations[activeKey]
  const messages = activeKey === SERVER_TAB ? state?.serverMessages : conversation?.messages
  const lastMessageId = messages?.at(-1)?.id
  let lastHistoryIndex = -1
  messages?.forEach((message, index) => {
    if (message.history) lastHistoryIndex = index
  })

  useEffect(() => {
    const list = listRef.current
    if (list) {
      list.scrollTop = list.scrollHeight
    }
  }, [lastMessageId, activeKey, chat?.isOpen])

  useEffect(() => {
    if (chat?.isOpen && chat.draft) {
      inputRef.current?.focus()
    }
  }, [chat?.isOpen, chat?.draft, activeKey])

  if (!chat || !chat.enabled || !state) {
    return null
  }

  const totalUnread = state.order.reduce(
    (sum, key) => sum + (state.conversations[key]?.unread ?? 0),
    0,
  )
  const anyMention = state.order.some((key) => state.conversations[key]?.mentioned)
  const isConnected = state.status === 'connected'
  const showNickForm = state.status === 'idle'

  function handleSend(event: FormEvent) {
    event.preventDefault()
    if (!chat || !state) return
    chat.session.submit(state.active, chat.draft)
    chat.setDraft('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      chat?.close()
    }
  }

  if (!chat.isOpen) {
    return (
      <button className="chat-launcher" type="button" onClick={() => chat.open()}>
        <span aria-hidden="true">💬</span> Chat
        {totalUnread > 0 ? (
          <span
            className={`chat-launcher__badge${anyMention ? ' chat-launcher__badge--mention' : ''}`}
          >
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <section className="chat-panel" aria-label="Chat">
      <header className="chat-panel__header">
        <div>
          <strong>LAN chat</strong>
          <small>
            {state.status === 'connected' && (
              <button
                type="button"
                className="chat-rename-trigger"
                onClick={() => setRenaming((value) => !value)}
                title="Naam wijzigen"
              >
                Verbonden als <strong>{state.nick}</strong> <span aria-hidden="true">✎</span>
              </button>
            )}
            {state.status === 'connecting' && 'Verbinden...'}
            {state.status === 'reconnecting' && 'Opnieuw verbinden...'}
            {state.status === 'idle' && 'Niet verbonden'}
          </small>
        </div>
        <div className="chat-panel__header-actions">
          {state.status !== 'idle' ? (
            <button
              type="button"
              className="chat-icon-button"
              onClick={chat.disconnect}
              title="Verbinding verbreken"
            >
              Uitloggen
            </button>
          ) : null}
          <button
            type="button"
            className="chat-icon-button"
            onClick={chat.close}
            aria-label="Chat sluiten"
          >
            ✕
          </button>
        </div>
      </header>

      {renaming && isConnected ? <RenameForm onDone={stopRenaming} /> : null}

      {showNickForm ? (
        <NickForm />
      ) : (
        <>
          <nav className="chat-tabs" aria-label="Kanalen">
            {state.order.map((key) => {
              const item = state.conversations[key]
              return (
                <button
                  key={key}
                  type="button"
                  className={`chat-tab${key === activeKey ? ' chat-tab--active' : ''}`}
                  onClick={() => chat.session.setActive(item.name)}
                >
                  {item.name}
                  {item.unread > 0 ? (
                    <span
                      className={`chat-tab__badge${item.mentioned ? ' chat-tab__badge--mention' : ''}`}
                    >
                      {item.unread}
                    </span>
                  ) : null}
                </button>
              )
            })}
            <button
              type="button"
              className={`chat-tab chat-tab--server${activeKey === SERVER_TAB ? ' chat-tab--active' : ''}`}
              onClick={() => chat.session.setActive(SERVER_TAB)}
              title="Serverberichten"
            >
              ⓘ
            </button>
          </nav>

          {conversation ? (
            <div className="chat-topic">
              <span>
                {conversation.topic ||
                  CHANNEL_DESCRIPTIONS[conversation.name.toLowerCase()] ||
                  (conversation.isChannel ? 'Geen onderwerp' : 'Privégesprek')}
              </span>
              {conversation.isChannel ? (
                <button
                  type="button"
                  className="chat-topic__users"
                  onClick={() => setShowUsers((value) => !value)}
                >
                  {conversation.users.length} online
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="chat-body">
            <ul className="chat-messages" ref={listRef}>
              {state.error ? (
                <li className="chat-message chat-message--event">{state.error}</li>
              ) : null}
              {messages?.length ? (
                messages.map((message, index) => (
                  <Fragment key={message.id}>
                    <MessageLine message={message} />
                    {index === lastHistoryIndex ? (
                      <li className="chat-divider">
                        <span>eerdere berichten · nu live</span>
                      </li>
                    ) : null}
                  </Fragment>
                ))
              ) : (
                <li className="chat-message chat-message--event">
                  {isConnected
                    ? 'Nog geen berichten. Zeg eens hallo!'
                    : 'Verbinden met de chatserver...'}
                </li>
              )}
            </ul>

            {showUsers && conversation?.isChannel ? (
              <ul className="chat-users">
                {conversation.users.map((user) => {
                  const bare = user.replace(/^[~&@%+]+/, '')
                  return (
                    <li key={user}>
                      <button
                        type="button"
                        style={{ color: nickColor(bare) }}
                        title={`Privébericht naar ${bare}`}
                        onClick={() => bare !== state.nick && chat.session.openConversation(bare)}
                      >
                        {user}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>

          <form className="chat-input" onSubmit={handleSend}>
            <input
              ref={inputRef}
              value={chat.draft}
              onChange={(event) => chat.setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isConnected
                  ? activeKey === SERVER_TAB
                    ? 'Kies een kanaal om te praten'
                    : `Bericht aan ${state.active}`
                  : 'Even geduld...'
              }
              disabled={!isConnected}
              maxLength={400}
            />
            <button className="button" type="submit" disabled={!isConnected || !chat.draft.trim()}>
              Stuur
            </button>
          </form>
        </>
      )}
    </section>
  )
}
