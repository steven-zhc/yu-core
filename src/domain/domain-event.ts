import { nanoid } from 'nanoid'

export class DomainEvent<TPayload> {
  readonly _tag: string

  readonly id: string
  readonly createdAt: Date
  readonly commandId: string
  readonly aggregateId: string
  readonly payload: TPayload

  constructor(_tag: string, cid: string, aid: string, payload: TPayload) {
    this._tag = _tag
    this.id = nanoid()
    this.createdAt = new Date()
    this.commandId = cid
    this.aggregateId = aid
    this.payload = payload
  }

  is(tag: string): boolean {
    return this._tag === tag
  }
}

export const mkDomainEvent = <T>(
  tag: string,
  cid: string,
  aid: string,
  payload: T
): DomainEvent<T> => {
  return new DomainEvent<T>(tag, cid, aid, payload)
}

export const INIT_AGGREGATE_ID = 'INIT_AGGREGATE_ID'

export const mkInitDomainEvent = <T>(
  tag: string,
  cid: string,
  payload: T,
): DomainEvent<T> => {
  return new DomainEvent<T>(tag, cid, INIT_AGGREGATE_ID, payload)
}

export const showDomainEvent = <T>(e: DomainEvent<T>): string => {
  let payloadStr = ''
  try {
    payloadStr = JSON.stringify(e.payload)
  } catch {
    payloadStr = '[unserializable]'
  }

  return `${e.createdAt.toISOString()} :: ${e.commandId} :: ${e.aggregateId} :: ${e._tag.padEnd(12)} :: ${e.id} => ${payloadStr}`
}

export const domainEventToJSON = <T>(event: DomainEvent<T>) => ({
  _tag: event._tag,
  id: event.id,
  commandId: event.commandId,
  aggregateId: event.aggregateId,
  createdAt: event.createdAt.toISOString(),
  payload: event.payload,
})

type DomainEventMatcherInput<TReturn> = Record<string, (event: DomainEvent<any>) => TReturn>

export const matchDomainEvent = <TReturn>(
  event: DomainEvent<unknown>,
  cases: DomainEventMatcherInput<TReturn>,
  onDefault?: (event: DomainEvent<unknown>) => TReturn
): TReturn => {
  const handler = cases[event._tag]

  if (handler) {
    return handler(event)
  }

  if (onDefault) {
    return onDefault(event)
  }

  throw new Error(`Unhandled domain event tag: ${event._tag}`)
}
