// Minimale IRC-client die via een websocket met de Ergo IRC-server praat.
// Ergo stuurt bij het joinen de laatste berichten opnieuw (autoreplay-on-join);
// die herkennen we aan hun server-time en tonen we als geschiedenis.
// De state is immutable zodat React hem via useSyncExternalStore kan volgen.

export type ChatStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting'

export type ChatMessageKind =
  'message' | 'action' | 'notice' | 'join' | 'part' | 'quit' | 'nick' | 'topic' | 'system'

export interface ChatMessage {
  id: number
  time: number
  kind: ChatMessageKind
  nick?: string
  text: string
  self?: boolean
  mention?: boolean
  /** Bericht van vóór het moment dat je het kanaal binnenkwam. */
  history?: boolean
}

export interface ChatConversation {
  /** Naam zoals getoond, bv. "#lan" of "Piet" (privéberichten). */
  name: string
  isChannel: boolean
  topic: string
  users: string[]
  messages: ChatMessage[]
  unread: number
  mentioned: boolean
}

export interface IrcState {
  status: ChatStatus
  nick: string
  /** De naam die de gebruiker zelf koos (nick kan tijdelijk afwijken, bv. "Jeroen42"). */
  preferredNick: string
  /** Foutmelding van de laatste naamswijziging (bv. naam al in gebruik). */
  nickError: string | null
  /** Gesorteerd op volgorde van openen; key = lowercase naam. */
  conversations: Record<string, ChatConversation>
  order: string[]
  active: string
  serverMessages: ChatMessage[]
  error: string | null
}

export const SERVER_TAB = '*server'
export const DEFAULT_CHANNELS = ['#lan', '#hulp']

/** Omschrijving per vast kanaal, getoond als het kanaal (nog) geen topic heeft. */
export const CHANNEL_DESCRIPTIONS: Record<string, string> = {
  '#lan': 'Algemene chat, teams zoeken en uitdagingen.',
  '#hulp': 'Vragen over het installeren of spelen van de games.',
}

/** IRCv3-capabilities die we aanvragen als de server ze ondersteunt. */
const WANTED_CAPS = ['server-time', 'message-tags']

const MAX_MESSAGES = 500
const NICK_MAX_LENGTH = 20

const initialState: IrcState = {
  status: 'idle',
  nick: '',
  preferredNick: '',
  nickError: null,
  conversations: {},
  order: [],
  active: DEFAULT_CHANNELS[0],
  serverMessages: [],
  error: null,
}

let messageId = 0

function makeMessage(
  kind: ChatMessageKind,
  text: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  messageId += 1
  return { id: messageId, time: Date.now(), kind, text, ...extra }
}

export function sanitizeNick(input: string) {
  const cleaned = input
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_\-[\]\\`^{}|]/g, '')
    .replace(/^[-0-9]+/, '')
  return cleaned.slice(0, NICK_MAX_LENGTH)
}

const isChannelName = (name: string) => /^[#&+]/.test(name)
const keyOf = (name: string) => name.toLowerCase()
const stripPrefix = (nick: string) => nick.replace(/^[~&@%+]+/, '')

interface ParsedLine {
  tags: Record<string, string>
  prefix: string
  nick: string
  command: string
  params: string[]
}

function parseLine(line: string): ParsedLine {
  let rest = line
  const tags: Record<string, string> = {}
  if (rest.startsWith('@')) {
    const space = rest.indexOf(' ')
    for (const tag of rest.slice(1, space).split(';')) {
      const [key, value = ''] = tag.split('=')
      tags[key] = value
    }
    rest = rest.slice(space + 1)
  }

  let prefix = ''
  if (rest.startsWith(':')) {
    const space = rest.indexOf(' ')
    prefix = rest.slice(1, space)
    rest = rest.slice(space + 1)
  }

  const params: string[] = []
  while (rest.length > 0) {
    if (rest.startsWith(':')) {
      params.push(rest.slice(1))
      break
    }
    const space = rest.indexOf(' ')
    if (space === -1) {
      params.push(rest)
      break
    }
    if (space > 0) {
      params.push(rest.slice(0, space))
    }
    rest = rest.slice(space + 1)
  }

  const command = (params.shift() ?? '').toUpperCase()
  const nick = prefix.split('!')[0]
  return { tags, prefix, nick, command, params }
}

function getWebSocketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/irc-ws`
}

export class IrcSession {
  private state: IrcState = initialState
  private listeners = new Set<() => void>()
  private socket: WebSocket | null = null
  private availableCaps: string[] = []
  /** Tijdstip (server-tijd) waarop we een kanaal binnenkwamen; key = lowercase naam. */
  private joinTimes: Record<string, number> = {}
  private wantedNick = ''
  private registered = false
  private shouldReconnect = false
  private reconnectAttempts = 0
  private reconnectTimer: number | undefined
  private reclaimTimer: number | undefined
  private reclaiming = false
  /** Naamswijziging via het formulier: fouten alleen daar tonen, niet ook in het kanaal. */
  private quietNickChange = false
  private pendingNames: Record<string, string[]> = {}
  private visible = false

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => this.state

  private setState(update: (state: IrcState) => IrcState) {
    this.state = update(this.state)
    this.listeners.forEach((listener) => listener())
  }

  // ---------------------------------------------------------------- publiek

  connect(nick: string) {
    this.wantedNick = sanitizeNick(nick)
    if (!this.wantedNick) {
      return
    }
    this.setState((state) => ({ ...state, preferredNick: this.wantedNick }))
    this.shouldReconnect = true
    this.reconnectAttempts = 0
    this.openSocket()
  }

  disconnect() {
    this.shouldReconnect = false
    window.clearTimeout(this.reconnectTimer)
    window.clearTimeout(this.reclaimTimer)
    if (this.socket) {
      this.sendRaw('QUIT :Tot later!')
      this.socket.close()
      this.socket = null
    }
    this.setState((state) => ({ ...state, status: 'idle' }))
  }

  /**
   * Direct opnieuw verbinden als de verbinding weg is maar wel gewenst.
   * Mobiele browsers verbreken websockets als de app op de achtergrond staat.
   */
  reconnectNow() {
    const socketAlive =
      this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING
    if (this.shouldReconnect && !socketAlive) {
      this.reconnectAttempts = 0
      this.openSocket()
    }
  }

  setVisible(visible: boolean) {
    this.visible = visible
    if (visible) {
      this.markRead(this.state.active)
    }
  }

  setActive(name: string) {
    this.setState((state) => ({ ...state, active: name }))
    this.markRead(name)
  }

  /** Open een kanaal (en join het als dat nog niet gebeurd is). */
  openConversation(name: string) {
    const key = keyOf(name)
    if (isChannelName(name) && !this.state.conversations[key] && this.registered) {
      this.sendRaw(`JOIN ${name}`)
    }
    if (!isChannelName(name) && !this.state.conversations[key]) {
      this.ensureConversation(name)
    }
    this.setActive(name)
  }

  closeConversation(name: string) {
    const key = keyOf(name)
    if (isChannelName(name) && this.registered) {
      this.sendRaw(`PART ${name}`)
    }
    this.removeConversation(key)
  }

  /**
   * Vraag een nieuwe naam aan. De naam wordt pas bewaard als de server hem accepteert
   * (NICK-bericht terug); anders komt er een melding in `nickError`.
   * Met `quiet` (het naamformulier) komt die melding niet óók als regel in het kanaal.
   */
  changeNick(input: string, { quiet = false } = {}) {
    const nick = sanitizeNick(input)
    this.quietNickChange = quiet
    if (!nick) {
      this.reportNickError('Kies een naam met letters of cijfers.')
      return
    }
    if (nick === this.state.nick || !this.registered) {
      this.setState((state) => ({ ...state, nickError: null }))
      return
    }
    window.clearTimeout(this.reclaimTimer)
    this.reclaiming = false
    this.setState((state) => ({ ...state, nickError: null }))
    this.sendRaw(`NICK ${nick}`)
  }

  private reportNickError(error: string) {
    this.setState((state) => ({ ...state, nickError: error }))
    if (!this.quietNickChange) {
      this.addMessage(this.state.active, makeMessage('system', error))
    }
  }

  clearNickError() {
    if (this.state.nickError) {
      this.setState((state) => ({ ...state, nickError: null }))
    }
  }

  /** Verwerkt invoer uit het tekstvak, inclusief simpele /commando's. */
  submit(target: string, input: string) {
    const text = input.trim()
    if (!text || !this.registered) {
      return
    }

    if (text.startsWith('/') && !text.startsWith('//')) {
      this.runCommand(target, text.slice(1))
      return
    }

    const message = text.startsWith('//') ? text.slice(1) : text
    this.sendMessage(target, message)
  }

  // ---------------------------------------------------------------- socket

  private openSocket() {
    window.clearTimeout(this.reconnectTimer)
    this.socket?.close()
    this.registered = false
    this.availableCaps = []

    this.setState((state) => ({
      ...state,
      status: this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting',
      error: null,
    }))

    let socket: WebSocket
    try {
      // text.ircv3.net: elk websocket-frame is precies één IRC-regel (UTF-8 tekst).
      socket = new WebSocket(getWebSocketUrl(), ['text.ircv3.net'])
    } catch {
      this.scheduleReconnect()
      return
    }
    this.socket = socket

    socket.onopen = () => {
      this.sendRaw('CAP LS 302')
      this.sendRaw(`NICK ${this.wantedNick}`)
      this.sendRaw(`USER ${this.wantedNick.toLowerCase().slice(0, 10) || 'web'} 0 * :LAN webchat`)
    }

    socket.onmessage = (event) => {
      String(event.data)
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => this.handleLine(line))
    }

    socket.onclose = () => {
      if (this.socket !== socket) {
        return
      }
      this.socket = null
      this.registered = false
      if (this.shouldReconnect) {
        this.scheduleReconnect()
      } else {
        this.setState((state) => ({ ...state, status: 'idle' }))
      }
    }
  }

  private scheduleReconnect() {
    this.reconnectAttempts += 1
    const delay = Math.min(30000, 2000 * this.reconnectAttempts)
    this.setState((state) => ({
      ...state,
      status: 'reconnecting',
      error: 'Verbinding met de chatserver verbroken, opnieuw verbinden...',
    }))
    this.reconnectTimer = window.setTimeout(() => this.openSocket(), delay)
  }

  /**
   * Was je naam bezet (meestal door je eigen vorige verbinding die nog niet weg is),
   * probeer hem dan na een paar seconden één keer terug te krijgen.
   */
  private scheduleNickReclaim(currentNick: string) {
    window.clearTimeout(this.reclaimTimer)
    const preferred = this.state.preferredNick
    if (!preferred || keyOf(preferred) === keyOf(currentNick)) {
      return
    }
    this.reclaimTimer = window.setTimeout(() => {
      if (this.registered && keyOf(this.state.nick) !== keyOf(preferred)) {
        this.reclaiming = true
        this.sendRaw(`NICK ${preferred}`)
      }
    }, 5000)
  }

  private sendRaw(line: string) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(line.replace(/[\r\n]/g, ' '))
    }
  }

  // ---------------------------------------------------------------- commando's

  private sendMessage(target: string, message: string, action = false) {
    if (target === SERVER_TAB) {
      this.addServerMessage(makeMessage('system', 'Kies eerst een kanaal om in te praten.'))
      return
    }
    const payload = action ? `\x01ACTION ${message}\x01` : message
    this.sendRaw(`PRIVMSG ${target} :${payload}`)
    this.addMessage(
      target,
      makeMessage(action ? 'action' : 'message', message, {
        nick: this.state.nick,
        self: true,
      }),
    )
  }

  private runCommand(target: string, commandLine: string) {
    const [rawCommand, ...args] = commandLine.split(' ')
    const command = rawCommand.toLowerCase()
    const rest = args.join(' ').trim()

    switch (command) {
      case 'me':
        if (rest) this.sendMessage(target, rest, true)
        return
      case 'nick':
        if (rest) this.changeNick(rest)
        return
      case 'join':
      case 'j': {
        const channel = rest.split(' ')[0]
        if (channel) this.openConversation(isChannelName(channel) ? channel : `#${channel}`)
        return
      }
      case 'part':
      case 'leave':
        this.closeConversation(target)
        return
      case 'msg':
      case 'query': {
        const [to, ...words] = args
        if (!to) return
        this.openConversation(to)
        if (words.length) this.sendMessage(to, words.join(' '))
        return
      }
      case 'topic':
        if (isChannelName(target))
          this.sendRaw(rest ? `TOPIC ${target} :${rest}` : `TOPIC ${target}`)
        return
      case 'raw':
      case 'quote':
        if (rest) this.sendRaw(rest)
        return
      default:
        this.addMessage(
          target,
          makeMessage(
            'system',
            `Onbekend commando /${command}. Beschikbaar: /me, /nick, /join, /part, /msg, /topic.`,
          ),
        )
    }
  }

  // ---------------------------------------------------------------- protocol

  private handleLine(line: string) {
    const { tags, nick, command, params } = parseLine(line)
    const me = this.state.nick || this.wantedNick
    const isMe = (name: string) => keyOf(name) === keyOf(me)
    const serverTime = tags.time ? Date.parse(tags.time) || Date.now() : Date.now()

    switch (command) {
      case 'CAP': {
        const subcommand = params[1]
        if (subcommand === 'LS') {
          // Een lange lijst komt in meerdere regels; '*' betekent "er komt nog meer".
          const isLastLine = params[2] !== '*'
          const caps = (isLastLine ? params[2] : params[3]) ?? ''
          this.availableCaps.push(...caps.split(' ').map((cap) => cap.split('=')[0]))
          if (isLastLine) {
            const request = WANTED_CAPS.filter((cap) => this.availableCaps.includes(cap))
            this.sendRaw(request.length ? `CAP REQ :${request.join(' ')}` : 'CAP END')
          }
        } else if (subcommand === 'ACK' || subcommand === 'NAK') {
          this.sendRaw('CAP END')
        }
        return
      }

      case 'PING':
        this.sendRaw(`PONG :${params[0] ?? ''}`)
        return

      case '001': {
        this.registered = true
        this.reconnectAttempts = 0
        const confirmedNick = params[0]
        this.setState((state) => ({
          ...state,
          status: 'connected',
          nick: confirmedNick,
          error: null,
        }))
        this.scheduleNickReclaim(confirmedNick)
        // Na een reconnect stuurt de server de geschiedenis opnieuw: oude berichten weg,
        // anders staan ze er dubbel in.
        this.state.order.forEach((key) =>
          this.updateConversation(key, (conversation) =>
            conversation.isChannel ? { ...conversation, messages: [] } : conversation,
          ),
        )
        const existingChannels = this.state.order
          .map((key) => this.state.conversations[key])
          .filter((conversation) => conversation.isChannel)
          .map((conversation) => conversation.name)
        const channels = existingChannels.length ? existingChannels : DEFAULT_CHANNELS
        this.sendRaw(`JOIN ${channels.join(',')}`)
        return
      }

      case '433': // nickname in gebruik
      case '436': {
        if (!this.registered) {
          const base = this.wantedNick.slice(0, NICK_MAX_LENGTH - 2)
          this.wantedNick = `${base}${Math.floor(Math.random() * 90 + 10)}`
          this.sendRaw(`NICK ${this.wantedNick}`)
        } else if (this.reclaiming) {
          this.reclaiming = false
        } else {
          this.reportNickError(`De naam ${params[1]} is al in gebruik.`)
        }
        return
      }

      case '432': // ongeldige nickname
        if (!this.registered) {
          this.wantedNick = `Gast${Math.floor(Math.random() * 900 + 100)}`
          this.sendRaw(`NICK ${this.wantedNick}`)
        } else {
          this.reportNickError(`Ongeldige naam: ${params[1]}`)
        }
        return

      case 'NICK': {
        const newNick = params[0]
        if (isMe(nick)) {
          this.reclaiming = false
          this.setState((state) => ({
            ...state,
            nick: newNick,
            preferredNick: newNick,
            nickError: null,
          }))
        }
        this.forEachConversationWith(nick, (key) => {
          this.updateConversation(key, (conversation) => ({
            ...conversation,
            users: sortUsers(conversation.users.map((user) => renameUser(user, nick, newNick))),
          }))
          this.pushMessage(key, makeMessage('nick', `${nick} heet nu ${newNick}`))
        })
        return
      }

      case 'JOIN': {
        const channel = params[0]
        if (isMe(nick)) {
          this.joinTimes[keyOf(channel)] = serverTime
          this.ensureConversation(channel)
        } else {
          this.updateConversation(keyOf(channel), (conversation) => ({
            ...conversation,
            users: sortUsers([...conversation.users, nick]),
          }))
          this.pushMessage(keyOf(channel), makeMessage('join', `${nick} kwam binnen`))
        }
        return
      }

      case 'PART': {
        const channel = params[0]
        if (isMe(nick)) {
          this.removeConversation(keyOf(channel))
        } else {
          this.removeUser(keyOf(channel), nick)
          this.pushMessage(keyOf(channel), makeMessage('part', `${nick} ging weg`))
        }
        return
      }

      case 'KICK': {
        const [channel, victim, reason] = params
        if (isMe(victim)) {
          this.pushMessage(
            keyOf(channel),
            makeMessage(
              'system',
              `Je bent uit ${channel} gezet door ${nick}${reason ? `: ${reason}` : ''}`,
            ),
          )
          this.updateConversation(keyOf(channel), (conversation) => ({
            ...conversation,
            users: [],
          }))
        } else {
          this.removeUser(keyOf(channel), victim)
          this.pushMessage(
            keyOf(channel),
            makeMessage('part', `${victim} is eruit gezet door ${nick}`),
          )
        }
        return
      }

      case 'QUIT':
        this.forEachConversationWith(nick, (key) => {
          this.removeUser(key, nick)
          this.pushMessage(key, makeMessage('quit', `${nick} is vertrokken`))
        })
        return

      case 'PRIVMSG':
      case 'NOTICE': {
        const [target, rawText = ''] = params
        if (!nick || nick.includes('.')) {
          // Bericht van de server zelf.
          this.addServerMessage(makeMessage('notice', rawText))
          return
        }

        let text = rawText
        let kind: ChatMessageKind = command === 'NOTICE' ? 'notice' : 'message'
        if (text.startsWith('\x01')) {
          const ctcp = text.replaceAll('\x01', '')
          if (!ctcp.startsWith('ACTION ')) {
            return // overige CTCP (VERSION e.d.) negeren
          }
          text = ctcp.slice(7)
          kind = 'action'
        }

        const conversation = isChannelName(target) ? target : nick
        const joinedAt = this.joinTimes[keyOf(conversation)]
        const history = isChannelName(target) && joinedAt !== undefined && serverTime < joinedAt
        const mention =
          !isChannelName(target) || new RegExp(`\\b${escapeRegExp(me)}\\b`, 'i').test(text)
        this.addMessage(
          conversation,
          makeMessage(kind, text, { nick, mention, history, self: isMe(nick), time: serverTime }),
        )
        return
      }

      case 'TOPIC':
        this.updateConversation(keyOf(params[0]), (conversation) => ({
          ...conversation,
          topic: params[1] ?? '',
        }))
        this.pushMessage(
          keyOf(params[0]),
          makeMessage('topic', `${nick} veranderde het onderwerp naar: ${params[1] ?? ''}`),
        )
        return

      case '332':
        this.updateConversation(keyOf(params[1]), (conversation) => ({
          ...conversation,
          topic: params[2] ?? '',
        }))
        return

      case '353': {
        const channel = keyOf(params[2])
        const names = (params[3] ?? '').split(' ').filter(Boolean)
        this.pendingNames[channel] = [...(this.pendingNames[channel] ?? []), ...names]
        return
      }

      case '366': {
        const channel = keyOf(params[1])
        const names = this.pendingNames[channel] ?? []
        delete this.pendingNames[channel]
        this.updateConversation(channel, (conversation) => ({
          ...conversation,
          users: sortUsers(names),
        }))
        return
      }

      case '401':
        this.addMessage(
          this.state.active,
          makeMessage('system', `${params[1]} is niet (meer) online.`),
        )
        return

      case '375':
      case '372':
      case '376':
      case '002':
      case '003':
      case '004':
      case '005':
      case '251':
      case '252':
      case '253':
      case '254':
      case '255':
      case '265':
      case '266':
      case '422':
        if (command === '372' || command === '422') {
          this.addServerMessage(makeMessage('notice', (params[1] ?? '').replace(/^- ?/, '')))
        }
        return

      case 'ERROR':
        this.addServerMessage(makeMessage('system', params[0] ?? 'Verbinding gesloten'))
        return

      default:
        if (/^[45]\d\d$/.test(command)) {
          this.addMessage(this.state.active, makeMessage('system', params.slice(1).join(' ')))
        }
    }
  }

  // ---------------------------------------------------------------- state-helpers

  private ensureConversation(name: string) {
    const key = keyOf(name)
    if (this.state.conversations[key]) {
      return
    }
    const conversation: ChatConversation = {
      name,
      isChannel: isChannelName(name),
      topic: '',
      users: [],
      messages: [],
      unread: 0,
      mentioned: false,
    }
    this.setState((state) => ({
      ...state,
      conversations: { ...state.conversations, [key]: conversation },
      order: [...state.order, key],
    }))
  }

  private removeConversation(key: string) {
    this.setState((state) => {
      const conversations = { ...state.conversations }
      delete conversations[key]
      const order = state.order.filter((item) => item !== key)
      const active =
        keyOf(state.active) === key ? (conversations[order[0]]?.name ?? SERVER_TAB) : state.active
      return { ...state, conversations, order, active }
    })
  }

  private updateConversation(
    key: string,
    update: (conversation: ChatConversation) => ChatConversation,
  ) {
    const conversation = this.state.conversations[key]
    if (!conversation) {
      return
    }
    this.setState((state) => ({
      ...state,
      conversations: { ...state.conversations, [key]: update(conversation) },
    }))
  }

  private removeUser(key: string, nick: string) {
    this.updateConversation(key, (conversation) => ({
      ...conversation,
      users: conversation.users.filter((user) => keyOf(stripPrefix(user)) !== keyOf(nick)),
    }))
  }

  private forEachConversationWith(nick: string, callback: (key: string) => void) {
    Object.entries(this.state.conversations).forEach(([key, conversation]) => {
      const inChannel = conversation.users.some((user) => keyOf(stripPrefix(user)) === keyOf(nick))
      if (inChannel || keyOf(conversation.name) === keyOf(nick)) {
        callback(key)
      }
    })
  }

  /** Voegt een bericht toe en telt ongelezen berichten bij. */
  private addMessage(name: string, message: ChatMessage) {
    if (name === SERVER_TAB) {
      this.addServerMessage(message)
      return
    }
    this.ensureConversation(name)
    const key = keyOf(name)
    this.pushMessage(key, message)

    const isRead = this.visible && keyOf(this.state.active) === key
    const countsAsUnread =
      !message.self && !message.history && (message.kind === 'message' || message.kind === 'action')
    if (!isRead && countsAsUnread) {
      this.updateConversation(key, (conversation) => ({
        ...conversation,
        unread: conversation.unread + 1,
        mentioned: conversation.mentioned || Boolean(message.mention),
      }))
    }
  }

  private pushMessage(key: string, message: ChatMessage) {
    this.updateConversation(key, (conversation) => ({
      ...conversation,
      messages: [...conversation.messages, message].slice(-MAX_MESSAGES),
    }))
  }

  private addServerMessage(message: ChatMessage) {
    this.setState((state) => ({
      ...state,
      serverMessages: [...state.serverMessages, message].slice(-MAX_MESSAGES),
    }))
  }

  private markRead(name: string) {
    this.updateConversation(keyOf(name), (conversation) =>
      conversation.unread || conversation.mentioned
        ? { ...conversation, unread: 0, mentioned: false }
        : conversation,
    )
  }
}

function sortUsers(users: string[]) {
  const rank = (user: string) => (user.startsWith('@') ? 0 : user.startsWith('+') ? 1 : 2)
  return [...new Set(users)].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      stripPrefix(a).localeCompare(stripPrefix(b), 'nl', { sensitivity: 'base' }),
  )
}

function renameUser(user: string, oldNick: string, newNick: string) {
  const bare = stripPrefix(user)
  if (keyOf(bare) !== keyOf(oldNick)) {
    return user
  }
  return `${user.slice(0, user.length - bare.length)}${newNick}`
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
