import { nanoid } from 'nanoid'

/**
 * Constant for events without an aggregate (Pattern 2 async jobs).
 * Use when aggregate doesn't exist yet at event creation time.
 */
export const NO_AGGREGATE_ID = '__NO_AGGREGATE__'

/**
 * System user ID for events not initiated by a human user.
 * Use for: scheduled jobs, migrations, event replay, internal services.
 */
export const SYSTEM_USER_ID = '__SYSTEM__'

export class DomainEvent<TPayload> {
  readonly _tag: string
  readonly id: string
  readonly createdAt: Date
  readonly userId: string
  readonly commandId: string
  readonly aggregateId: string
  readonly payload: TPayload

  constructor(
    _tag: string,
    userId: string,
    cid: string,
    aid: string,
    payload: TPayload
  ) {
    this._tag = _tag
    this.id = nanoid()
    this.createdAt = new Date()
    this.userId = userId
    this.commandId = cid
    this.aggregateId = aid
    this.payload = payload
  }

  is(tag: string): boolean {
    return this._tag === tag
  }

  /**
   * Check if this event has an aggregate (not NO_AGGREGATE_ID)
   */
  hasAggregate(): boolean {
    return this.aggregateId !== NO_AGGREGATE_ID
  }

  /**
   * Check if this event was initiated by a system process
   */
  isSystemEvent(): boolean {
    return this.userId === SYSTEM_USER_ID
  }
}

/**
 * Create a domain event (all fields required)
 * @param tag - Event type tag
 * @param userId - User who initiated the action
 * @param cid - Command ID (correlation)
 * @param aid - Aggregate ID
 * @param payload - Event data
 */
export const mkDomainEvent = <T>(
  tag: string,
  userId: string,
  cid: string,
  aid: string,
  payload: T
): DomainEvent<T> => {
  return new DomainEvent<T>(tag, userId, cid, aid, payload)
}

/**
 * Create a domain event without aggregate (Pattern 2)
 * @param tag - Event type tag
 * @param userId - User who initiated the action
 * @param cid - Command ID (correlation)
 * @param payload - Event data
 */
export const mkDomainEventWithoutAggregate = <T>(
  tag: string,
  userId: string,
  cid: string,
  payload: T
): DomainEvent<T> => {
  return new DomainEvent<T>(tag, userId, cid, NO_AGGREGATE_ID, payload)
}

/**
 * Create a system-initiated event (with aggregate)
 * @param tag - Event type tag
 * @param cid - Command ID (correlation)
 * @param aid - Aggregate ID
 * @param payload - Event data
 */
export const mkSystemEvent = <T>(
  tag: string,
  cid: string,
  aid: string,
  payload: T
): DomainEvent<T> => {
  return new DomainEvent<T>(tag, SYSTEM_USER_ID, cid, aid, payload)
}

/**
 * Create a system-initiated event without aggregate
 * @param tag - Event type tag
 * @param cid - Command ID (correlation)
 * @param payload - Event data
 */
export const mkSystemEventWithoutAggregate = <T>(
  tag: string,
  cid: string,
  payload: T
): DomainEvent<T> => {
  return new DomainEvent<T>(tag, SYSTEM_USER_ID, cid, NO_AGGREGATE_ID, payload)
}

export const showDomainEvent = <T>(e: DomainEvent<T>): string => {
  let payloadStr = ''
  try {
    payloadStr = JSON.stringify(e.payload)
  } catch {
    payloadStr = '[unserializable]'
  }

  const agg = e.hasAggregate() ? e.aggregateId : '-'
  const user = e.isSystemEvent() ? 'SYSTEM' : e.userId

  return `[${e.createdAt.toISOString()}] ${e._tag} | cmd=${e.commandId} agg=${agg} evt=${e.id} usr=${user} | ${payloadStr}`
}

export const domainEventToJSON = <T>(event: DomainEvent<T>) => ({
  _tag: event._tag,
  id: event.id,
  commandId: event.commandId,
  aggregateId: event.aggregateId,
  userId: event.userId,
  createdAt: event.createdAt.toISOString(),
  payload: event.payload,
})

/**
 * Helper type for defining domain event companion types.
 * Eliminates self-referencing indexed access in event type definitions.
 *
 * @example
 * ```typescript
 * export type MyEvent = EventDef<{ id: string }>
 * // equivalent to: { Payload: { id: string }; Event: DomainEvent<{ id: string }> }
 * ```
 */
export type EventDef<P> = { Payload: P; Event: DomainEvent<P> }

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
