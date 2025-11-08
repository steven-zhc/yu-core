/**
 * EventBus for domain events with pub/sub pattern.
 * Provides asynchronous event handling using Emittery.
 */

import Emittery from 'emittery'
import { type DomainEvent, showDomainEvent } from './domain-event.js'

/**
 * Event handler function type.
 * Takes a domain event and returns void or a Promise.
 */
export type EventHandler<T = any> = (event: DomainEvent<T>) => void | Promise<void>

/** Error payload delivered on the error channel */
export interface EventBusErrorEvent {
  eventTag: string
  event: DomainEvent<any>
  error: unknown
}

export const showEventBusError = (errorEvent: EventBusErrorEvent): string =>
  `${showDomainEvent(errorEvent.event)} :: ${JSON.stringify(errorEvent.error)}`

export type ErrorHandler = (err: EventBusErrorEvent) => void | Promise<void>

/**
 * Abstract EventBus interface for publishing and subscribing to domain events.
 */
export interface EventBus {
  /**
   * Publish a domain event to all registered subscribers.
   * Handlers are executed asynchronously.
   */
  readonly publish: <T>(event: DomainEvent<T>) => Promise<void>

  /**
   * Subscribe to domain events by event tag.
   * Multiple handlers can be registered for the same event tag.
   */
  readonly subscribe: <T = any>(eventTag: string, handler: EventHandler<T>) => void

  /**
   * Unsubscribe a specific handler from an event tag.
   */
  readonly unsubscribe: <T = any>(eventTag: string, handler: EventHandler<T>) => void

  /**
   * Subscribe to all domain events (wildcard).
   * Useful for logging, monitoring, or audit trails.
   */
  readonly subscribeAll: (handler: EventHandler) => void

  /**
   * Unsubscribe a wildcard handler.
   */
  readonly unsubscribeAll: (handler: EventHandler) => void

  /** Subscribe to handler errors emitted on the error channel */
  readonly subscribeErrors: (handler: ErrorHandler) => void

  /** Unsubscribe an error handler from the error channel */
  readonly unsubscribeErrors: (handler: ErrorHandler) => void
}

/**
 * Emittery-based EventBus implementation.
 * Provides async event handling with proper pub/sub semantics.
 */
export class EmitteryEventBus implements EventBus {
  private readonly emitter: Emittery
  // Map handlers to wrapped handlers for unsubscription
  private readonly handlerMap: WeakMap<EventHandler, (event: DomainEvent<any>) => Promise<void>>
  private readonly errorHandlerMap: WeakMap<ErrorHandler, (err: EventBusErrorEvent) => Promise<void>>

  private static readonly ERROR_EVENT = '__eventBusError__'

  constructor() {
    this.emitter = new Emittery()
    this.handlerMap = new WeakMap()
    this.errorHandlerMap = new WeakMap()
  }

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    await this.emitter.emit(event._tag, event)
  }

  subscribe<T = any>(eventTag: string, handler: EventHandler<T>): void {
    // Wrap handler to catch errors and notify error channel
    const wrappedHandler = async (event: DomainEvent<T>) => {
      try {
        await handler(event)
      } catch (error) {
        await this.emitter.emit(EmitteryEventBus.ERROR_EVENT, {
          eventTag,
          event: event as unknown as DomainEvent<any>,
          error,
        } satisfies EventBusErrorEvent)
      }
    }

    // Store mapping for unsubscribe
    this.handlerMap.set(handler as EventHandler, wrappedHandler)

    // Subscribe to Emittery
    this.emitter.on(eventTag, wrappedHandler)
  }

  unsubscribe<T = any>(eventTag: string, handler: EventHandler<T>): void {
    const wrappedHandler = this.handlerMap.get(handler as EventHandler)
    if (wrappedHandler) {
      this.emitter.off(eventTag, wrappedHandler)
    }
  }

  subscribeAll(handler: EventHandler): void {
    // Wrap handler for wildcard subscription
    const wrappedHandler = async (eventName: PropertyKey, event: DomainEvent<any>) => {
      try {
        await handler(event)
      } catch (error) {
        await this.emitter.emit(EmitteryEventBus.ERROR_EVENT, {
          eventTag: String(eventName),
          event,
          error,
        } satisfies EventBusErrorEvent)
      }
    }

    // Store mapping for unsubscribe
    this.handlerMap.set(handler, wrappedHandler as any)

    // Subscribe to all events
    this.emitter.onAny(wrappedHandler)
  }

  unsubscribeAll(handler: EventHandler): void {
    const wrappedHandler = this.handlerMap.get(handler)
    if (wrappedHandler) {
      this.emitter.offAny(wrappedHandler as any)
    }
  }

  subscribeErrors(handler: ErrorHandler): void {
    const wrapped = async (err: EventBusErrorEvent) => {
      await handler(err)
    }
    this.errorHandlerMap.set(handler, wrapped)
    this.emitter.on(EmitteryEventBus.ERROR_EVENT, wrapped)
  }

  unsubscribeErrors(handler: ErrorHandler): void {
    const wrapped = this.errorHandlerMap.get(handler)
    if (wrapped) {
      this.emitter.off(EmitteryEventBus.ERROR_EVENT, wrapped)
    }
  }
}

/**
 * Create a singleton EventBus instance.
 *
 * @example
 * ```typescript
 * import { createEventBus } from '@yu/core/domain'
 *
 * // Create event bus
 * const eventBus = createEventBus()
 *
 * // Subscribe to specific event
 * eventBus.subscribe('JobImported', (event) => {
 *   console.log('Job:', event.payload)
 * })
 *
 * // Subscribe to all events (logging)
 * eventBus.subscribeAll((event) => {
 *   console.log('[EVENT]', event._tag)
 * })
 *
 * // Publish event
 * await eventBus.publish(myEvent)
 * ```
 */
export const createEventBus = (): EventBus => new EmitteryEventBus()
