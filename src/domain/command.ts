import { nanoid } from 'nanoid'

export class Command<TPayload> {
  readonly _tag: string
  readonly id: string
  readonly userId: string
  readonly createdAt: Date
  readonly payload: TPayload

  constructor(tag: string, userId: string, payload: TPayload) {
    this._tag = tag
    this.id = nanoid()
    this.userId = userId
    this.createdAt = new Date()
    this.payload = payload
  }

  is(tag: string): boolean {
    return this._tag === tag
  }
}

export const mkCommand = <T>(tag: string, userId: string, payload: T): Command<T> =>
  new Command(tag, userId, payload)

export const showCommand = <T>(command: Command<T>): string => {
  let payloadStr = ''
  try {
    payloadStr = JSON.stringify(command.payload)
  } catch {
    payloadStr = '[unserializable]'
  }

  return `[${command.createdAt.toISOString()}] ${command._tag} | cmd=${command.id} usr=${command.userId} | ${payloadStr}`
}

export const cmdToJSON = <T>(command: Command<T>) => ({
  _tag: command._tag,
  id: command.id,
  userId: command.userId,
  createdAt: command.createdAt.toISOString(),
  payload: command.payload,
})
