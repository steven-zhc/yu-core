/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * EventBus for domain events with pub/sub pattern.
 * Provides asynchronous event handling using Emittery.
 */

import Emittery from 'emittery'
import { type DomainEvent, showDomainEvent } from './domain-event.js'
import { mapToDomainError, DomainError, showDomainError } from './domain-error.js'
import { EventBusError } from './common-error.js'

/**
 * Event handler function type.
 * Takes a domain event and returns void or a Promise.
 */
export type EventHandler<T = any> = (event: DomainEvent<T>) => void | Promise<void>

/** Error payload delivered on the error channel */
export interface EventBusErrorEvent {
  eventTag: string         // Original DomainEvent's tag (e.g., 'JobImported', 'ResumeGenerationQueued')
  errorTag: string         // DomainError's tag (e.g., 'LLMError', 'HallucinationDetectedError')
  event: DomainEvent<any>  // Original event that was being processed
  error: DomainError       // Error that was thrown
}

export const showEventBusError = (errorEvent: EventBusErrorEvent): string =>
  `${showDomainEvent(errorEvent.event)} :: ${showDomainError(errorEvent.error)}`

export type ErrorHandler = (errorEvent: EventBusErrorEvent) => void | Promise<void>

/**
 * Shape Emittery v2 delivers to every listener: a single `{ name, data }` object.
 *
 * This is the emittery-major breaking change (v1 → v2): v1 passed the raw data to
 * `on` listeners, and `onAny` listeners were called with `(name, data)` positionally.
 * v2 unifies both onto one event object, so every wrapped listener below takes this
 * shape and unwraps `data` (the DomainEvent, or the EventBusErrorEvent on the error channel).
 */
type EmitteryListener = (event: { readonly name: PropertyKey; readonly data: unknown }) => Promise<void>

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

  /** Subscribe to ALL handler errors emitted on the error channel */
  readonly subscribeErrors: (handler: ErrorHandler) => void

  /** Unsubscribe an error handler from the error channel */
  readonly unsubscribeErrors: (handler: ErrorHandler) => void

  /** Subscribe to errors by DomainError tag (error type) - handles specific error types across all events */
  readonly subscribeErrorsByErrorTag: (errorTag: string, handler: ErrorHandler) => void

  /** Unsubscribe an error handler for a specific error tag */
  readonly unsubscribeErrorsByErrorTag: (errorTag: string, handler: ErrorHandler) => void

  /** Subscribe to errors by DomainEvent tag (business event) - handles all errors from specific event handlers */
  readonly subscribeErrorsByEventTag: (eventTag: string, handler: ErrorHandler) => void

  /** Unsubscribe an error handler for a specific event tag */
  readonly unsubscribeErrorsByEventTag: (eventTag: string, handler: ErrorHandler) => void
}

/**
 * Emittery-based EventBus implementation.
 * Provides async event handling with proper pub/sub semantics.
 */
export class EmitteryEventBus implements EventBus {
  private readonly emitter: Emittery
  // Map handlers to wrapped handlers for unsubscription
  private readonly handlerMap: WeakMap<EventHandler, EmitteryListener>
  private readonly errorHandlerMap: WeakMap<ErrorHandler, EmitteryListener>
  // Map filtered error handlers by error tag: handler -> Map<errorTag, wrappedHandler>
  private readonly filteredByErrorTagMap: WeakMap<ErrorHandler, Map<string, EmitteryListener>>
  // Map filtered error handlers by event tag: handler -> Map<eventTag, wrappedHandler>
  private readonly filteredByEventTagMap: WeakMap<ErrorHandler, Map<string, EmitteryListener>>

  private static readonly ERROR_EVENT = '__error_event__'

  constructor() {
    this.emitter = new Emittery()
    this.handlerMap = new WeakMap()
    this.errorHandlerMap = new WeakMap()
    this.filteredByErrorTagMap = new WeakMap()
    this.filteredByEventTagMap = new WeakMap()
  }

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    await this.emitter.emit(event._tag, event)
  }

  subscribe<T = any>(eventTag: string, handler: EventHandler<T>): void {
    // Wrap handler to catch errors and notify error channel.
    // Emittery v2 passes a single `{ name, data }` object; unwrap `data` to the DomainEvent.
    const wrappedHandler: EmitteryListener = async ({ data }) => {
      const event = data as DomainEvent<T>
      try {
        await handler(event)
      } catch (error) {
        const domainError = mapToDomainError(EventBusError.UnknownError.tag)(error)
        await this.emitter.emit(EmitteryEventBus.ERROR_EVENT, {
          eventTag: eventTag,              // Original business event tag
          errorTag: domainError._tag,      // Error type tag
          event: event as unknown as DomainEvent<any>,
          error: domainError,
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
    // Wrap handler for wildcard subscription.
    // Emittery v2 delivers a single `{ name, data }` object to `onAny` listeners
    // (v1 called them with positional `(name, data)`).
    const wrappedHandler: EmitteryListener = async ({ name, data }) => {
      // Skip internal error channel to prevent infinite recursion:
      // wildcard throws → emit error → wildcard fires again → throws → ...
      if (name === EmitteryEventBus.ERROR_EVENT) return

      const event = data as DomainEvent<any>
      try {
        await handler(event)
      } catch (error) {
        const domainError = mapToDomainError(EventBusError.UnknownError.tag)(error)
        await this.emitter.emit(EmitteryEventBus.ERROR_EVENT, {
          eventTag: String(name),          // Original business event tag
          errorTag: domainError._tag,      // Error type tag
          event,
          error: domainError,
        } satisfies EventBusErrorEvent)
      }
    }

    // Store mapping for unsubscribe
    this.handlerMap.set(handler, wrappedHandler)

    // Subscribe to all events
    this.emitter.onAny(wrappedHandler)
  }

  unsubscribeAll(handler: EventHandler): void {
    const wrappedHandler = this.handlerMap.get(handler)
    if (wrappedHandler) {
      this.emitter.offAny(wrappedHandler)
    }
  }

  subscribeErrors(handler: ErrorHandler): void {
    const wrapped: EmitteryListener = async ({ data }) => {
      await handler(data as EventBusErrorEvent)
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

  subscribeErrorsByErrorTag(errorTag: string, handler: ErrorHandler): void {
    // Wrap handler to filter by error tag (DomainError type)
    const wrapped: EmitteryListener = async ({ data }) => {
      const errorEvent = data as EventBusErrorEvent
      if (errorEvent.errorTag === errorTag) {
        await handler(errorEvent)
      }
    }

    // Get or create the map for this handler
    let tagMap = this.filteredByErrorTagMap.get(handler)
    if (!tagMap) {
      tagMap = new Map()
      this.filteredByErrorTagMap.set(handler, tagMap)
    }

    // Store the wrapped handler for this error tag
    tagMap.set(errorTag, wrapped)

    // Subscribe to the error channel
    this.emitter.on(EmitteryEventBus.ERROR_EVENT, wrapped)
  }

  unsubscribeErrorsByErrorTag(errorTag: string, handler: ErrorHandler): void {
    const tagMap = this.filteredByErrorTagMap.get(handler)
    if (!tagMap) {
      return
    }

    const wrapped = tagMap.get(errorTag)
    if (wrapped) {
      this.emitter.off(EmitteryEventBus.ERROR_EVENT, wrapped)
      tagMap.delete(errorTag)

      // Clean up the map if empty
      if (tagMap.size === 0) {
        this.filteredByErrorTagMap.delete(handler)
      }
    }
  }

  subscribeErrorsByEventTag(eventTag: string, handler: ErrorHandler): void {
    // Wrap handler to filter by event tag (business event type)
    const wrapped: EmitteryListener = async ({ data }) => {
      const errorEvent = data as EventBusErrorEvent
      if (errorEvent.eventTag === eventTag) {
        await handler(errorEvent)
      }
    }

    // Get or create the map for this handler
    let tagMap = this.filteredByEventTagMap.get(handler)
    if (!tagMap) {
      tagMap = new Map()
      this.filteredByEventTagMap.set(handler, tagMap)
    }

    // Store the wrapped handler for this event tag
    tagMap.set(eventTag, wrapped)

    // Subscribe to the error channel
    this.emitter.on(EmitteryEventBus.ERROR_EVENT, wrapped)
  }

  unsubscribeErrorsByEventTag(eventTag: string, handler: ErrorHandler): void {
    const tagMap = this.filteredByEventTagMap.get(handler)
    if (!tagMap) {
      return
    }

    const wrapped = tagMap.get(eventTag)
    if (wrapped) {
      this.emitter.off(EmitteryEventBus.ERROR_EVENT, wrapped)
      tagMap.delete(eventTag)

      // Clean up the map if empty
      if (tagMap.size === 0) {
        this.filteredByEventTagMap.delete(handler)
      }
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
