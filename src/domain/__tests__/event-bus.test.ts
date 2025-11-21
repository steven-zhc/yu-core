import { describe, it, expect } from 'vitest'
import { createEventBus, type EventBus, type EventBusErrorEvent } from '../event-bus.js'
import { mkDomainEvent, type DomainEvent } from '../domain-event.js'

const TAG_A = 'TestEventA'
const TAG_B = 'TestEventB'

const mkEvent = <T>(tag: string, payload: T): DomainEvent<T> =>
  mkDomainEvent(tag, 'cmd-1', 'agg-1', payload)

describe('EmitteryEventBus', () => {
  it('publishes to subscribed handler', async () => {
    const bus: EventBus = createEventBus()

    let received: DomainEvent<{ foo: string }> | undefined
    bus.subscribe(TAG_A, (e) => {
      received = e as any
    })

    await bus.publish(mkEvent(TAG_A, { foo: 'bar' }))
    expect(received?._tag).toBe(TAG_A)
    expect(received?.payload).toEqual({ foo: 'bar' })
  })

  it('does not abort other handlers when one throws and emits to error channel', async () => {
    const bus: EventBus = createEventBus()

    let okCalled = false
    let errorSeen: EventBusErrorEvent | undefined
    bus.subscribeErrors((e) => {
      errorSeen = e
    })
    bus.subscribe(TAG_A, () => {
      throw new Error('boom')
    })
    bus.subscribe(TAG_A, () => {
      okCalled = true
    })

    await bus.publish(mkEvent(TAG_A, { n: 1 }))
    expect(okCalled).toBe(true)
    expect(errorSeen?.eventTag).toBe(TAG_A)  // Business event tag
    expect(errorSeen?.errorTag).toBeDefined()  // Error type tag
    expect(errorSeen?.error).toBeInstanceOf(Error)
  })

  it('unsubscribe removes a specific handler', async () => {
    const bus: EventBus = createEventBus()

    let count = 0
    const handler = () => {
      count += 1
    }

    bus.subscribe(TAG_A, handler)
    bus.unsubscribe(TAG_A, handler)
    await bus.publish(mkEvent(TAG_A, { n: 1 }))

    expect(count).toBe(0)
  })

  it('subscribeAll receives all events and can be unsubscribed', async () => {
    const bus: EventBus = createEventBus()

    let seen: string[] = []
    const wildcard = (e: DomainEvent<any>) => {
      seen.push(e._tag)
    }

    bus.subscribeAll(wildcard)
    await bus.publish(mkEvent(TAG_A, { a: 1 }))
    await bus.publish(mkEvent(TAG_B, { b: 2 }))

    expect(seen).toEqual([TAG_A, TAG_B])

    bus.unsubscribeAll(wildcard)
    await bus.publish(mkEvent(TAG_A, { a: 3 }))

    // No new entries after unsubscribe
    expect(seen).toEqual([TAG_A, TAG_B])
  })

  it('emits to error channel when wildcard handler throws', async () => {
    const bus: EventBus = createEventBus()

    let errorSeen: EventBusErrorEvent | undefined
    bus.subscribeErrors((e) => {
      errorSeen = e
    })

    const wildcard = () => {
      throw new Error('wild-boom')
    }
    bus.subscribeAll(wildcard)
    await bus.publish(mkEvent(TAG_A, { x: 1 }))

    expect(errorSeen?.eventTag).toBe(TAG_A)  // Business event tag
    expect(errorSeen?.errorTag).toBeDefined()  // Error type tag
    expect(errorSeen?.error).toBeInstanceOf(Error)

    bus.unsubscribeAll(wildcard)
  })

  it('unsubscribeErrors stops receiving error events', async () => {
    const bus: EventBus = createEventBus()

    let count = 0
    const errHandler = () => {
      count += 1
    }
    bus.subscribeErrors(errHandler)
    bus.unsubscribeErrors(errHandler)

    bus.subscribe(TAG_A, () => {
      throw new Error('will not be observed')
    })
    await bus.publish(mkEvent(TAG_A, { n: 42 }))

    expect(count).toBe(0)
  })

  it('subscribeErrorsByEventTag only receives errors from specific business event', async () => {
    const bus: EventBus = createEventBus()

    const receivedErrors: EventBusErrorEvent[] = []
    bus.subscribeErrorsByEventTag(TAG_A, (e) => {
      receivedErrors.push(e)
    })

    // Subscribe handlers that throw for both TAG_A and TAG_B
    bus.subscribe(TAG_A, () => {
      throw new Error('error-a')
    })
    bus.subscribe(TAG_B, () => {
      throw new Error('error-b')
    })

    await bus.publish(mkEvent(TAG_A, { n: 1 }))
    await bus.publish(mkEvent(TAG_B, { n: 2 }))

    // Should only receive error from TAG_A business event
    expect(receivedErrors).toHaveLength(1)
    expect(receivedErrors[0].eventTag).toBe(TAG_A)
  })

  it('unsubscribeErrorsByEventTag stops receiving errors for specific event tag', async () => {
    const bus: EventBus = createEventBus()

    let count = 0
    const errHandler = () => {
      count += 1
    }

    bus.subscribeErrorsByEventTag(TAG_A, errHandler)
    bus.unsubscribeErrorsByEventTag(TAG_A, errHandler)

    bus.subscribe(TAG_A, () => {
      throw new Error('will not be observed')
    })
    await bus.publish(mkEvent(TAG_A, { n: 42 }))

    expect(count).toBe(0)
  })

  it('subscribeErrorsByErrorTag only receives errors of specific error type', async () => {
    const bus: EventBus = createEventBus()

    const receivedErrors: EventBusErrorEvent[] = []
    const TARGET_ERROR_TAG = 'UnknownError'

    bus.subscribeErrorsByErrorTag(TARGET_ERROR_TAG, (e) => {
      receivedErrors.push(e)
    })

    // Both handlers throw (will be converted to UnknownError)
    bus.subscribe(TAG_A, () => {
      throw new Error('error-a')
    })
    bus.subscribe(TAG_B, () => {
      throw new Error('error-b')
    })

    await bus.publish(mkEvent(TAG_A, { n: 1 }))
    await bus.publish(mkEvent(TAG_B, { n: 2 }))

    // Should receive errors from both events since they're the same error type
    expect(receivedErrors).toHaveLength(2)
    expect(receivedErrors[0].errorTag).toBe(TARGET_ERROR_TAG)
    expect(receivedErrors[1].errorTag).toBe(TARGET_ERROR_TAG)
    expect(receivedErrors[0].eventTag).toBe(TAG_A)
    expect(receivedErrors[1].eventTag).toBe(TAG_B)
  })

  it('unsubscribeErrorsByErrorTag stops receiving errors for specific error type', async () => {
    const bus: EventBus = createEventBus()

    let count = 0
    const errHandler = () => {
      count += 1
    }

    bus.subscribeErrorsByErrorTag('UnknownError', errHandler)
    bus.unsubscribeErrorsByErrorTag('UnknownError', errHandler)

    bus.subscribe(TAG_A, () => {
      throw new Error('will not be observed')
    })
    await bus.publish(mkEvent(TAG_A, { n: 42 }))

    expect(count).toBe(0)
  })
})
