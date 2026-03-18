/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  DomainEvent,
  mkDomainEvent,
  mkDomainEventWithoutAggregate,
  mkSystemEvent,
  mkSystemEventWithoutAggregate,
  NO_AGGREGATE_ID,
  SYSTEM_USER_ID,
  showDomainEvent,
  domainEventToJSON,
  matchDomainEvent,
} from '../domain-event.js'

describe('DomainEvent', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  describe('constructor', () => {
    it('creates an event with all required fields', () => {
      const payload = { name: 'Alice' }
      const event = new DomainEvent('UserCreated', 'user-1', 'cmd-1', 'agg-1', payload)

      expect(event._tag).toBe('UserCreated')
      expect(event.userId).toBe('user-1')
      expect(event.commandId).toBe('cmd-1')
      expect(event.aggregateId).toBe('agg-1')
      expect(event.payload).toEqual(payload)
      expect(event.id).toBeDefined()
      expect(event.id.length).toBeGreaterThan(0)
      expect(event.createdAt).toBeInstanceOf(Date)
    })

    it('generates unique IDs for different events', () => {
      const event1 = new DomainEvent('Test', 'user-1', 'cmd-1', 'agg-1', {})
      const event2 = new DomainEvent('Test', 'user-1', 'cmd-1', 'agg-1', {})

      expect(event1.id).not.toBe(event2.id)
    })

    it('preserves payload reference', () => {
      const payload = { nested: { value: 42 } }
      const event = new DomainEvent('Test', 'user-1', 'cmd-1', 'agg-1', payload)

      expect(event.payload).toBe(payload)
    })
  })

  describe('is', () => {
    it('returns true when tag matches', () => {
      const event = new DomainEvent('UserCreated', 'user-1', 'cmd-1', 'agg-1', {})

      expect(event.is('UserCreated')).toBe(true)
    })

    it('returns false when tag does not match', () => {
      const event = new DomainEvent('UserCreated', 'user-1', 'cmd-1', 'agg-1', {})

      expect(event.is('UserDeleted')).toBe(false)
    })

    it('is case-sensitive', () => {
      const event = new DomainEvent('UserCreated', 'user-1', 'cmd-1', 'agg-1', {})

      expect(event.is('usercreated')).toBe(false)
      expect(event.is('USERCREATED')).toBe(false)
    })
  })

  describe('hasAggregate', () => {
    it('returns true when aggregateId is not NO_AGGREGATE_ID', () => {
      const event = new DomainEvent('Test', 'user-1', 'cmd-1', 'agg-1', {})

      expect(event.hasAggregate()).toBe(true)
    })

    it('returns false when aggregateId is NO_AGGREGATE_ID', () => {
      const event = new DomainEvent('Test', 'user-1', 'cmd-1', NO_AGGREGATE_ID, {})

      expect(event.hasAggregate()).toBe(false)
    })
  })

  describe('isSystemEvent', () => {
    it('returns true when userId is SYSTEM_USER_ID', () => {
      const event = new DomainEvent('Test', SYSTEM_USER_ID, 'cmd-1', 'agg-1', {})

      expect(event.isSystemEvent()).toBe(true)
    })

    it('returns false when userId is not SYSTEM_USER_ID', () => {
      const event = new DomainEvent('Test', 'user-1', 'cmd-1', 'agg-1', {})

      expect(event.isSystemEvent()).toBe(false)
    })
  })

  describe('mkDomainEvent', () => {
    it('creates an event using factory function', () => {
      const payload = { userId: '123' }
      const event = mkDomainEvent('UserCreated', 'user-1', 'cmd-1', 'agg-1', payload)

      expect(event).toBeInstanceOf(DomainEvent)
      expect(event._tag).toBe('UserCreated')
      expect(event.userId).toBe('user-1')
      expect(event.commandId).toBe('cmd-1')
      expect(event.aggregateId).toBe('agg-1')
      expect(event.payload).toEqual(payload)
    })

    it('handles different payload types', () => {
      const stringEvent = mkDomainEvent('String', 'user-1', 'cmd-1', 'agg-1', 'text')
      const numberEvent = mkDomainEvent('Number', 'user-1', 'cmd-1', 'agg-1', 42)
      const arrayEvent = mkDomainEvent('Array', 'user-1', 'cmd-1', 'agg-1', [1, 2, 3])
      const nullEvent = mkDomainEvent('Null', 'user-1', 'cmd-1', 'agg-1', null)

      expect(stringEvent.payload).toBe('text')
      expect(numberEvent.payload).toBe(42)
      expect(arrayEvent.payload).toEqual([1, 2, 3])
      expect(nullEvent.payload).toBe(null)
    })
  })

  describe('mkDomainEventWithoutAggregate', () => {
    it('creates an event with NO_AGGREGATE_ID', () => {
      const event = mkDomainEventWithoutAggregate('UserCreated', 'user-1', 'cmd-1', { userId: '123' })

      expect(event.aggregateId).toBe(NO_AGGREGATE_ID)
      expect(event._tag).toBe('UserCreated')
      expect(event.userId).toBe('user-1')
      expect(event.commandId).toBe('cmd-1')
    })

    it('uses special NO_AGGREGATE_ID constant', () => {
      const event = mkDomainEventWithoutAggregate('Test', 'user-1', 'cmd-1', {})

      expect(event.aggregateId).toBe('__NO_AGGREGATE__')
      expect(event.hasAggregate()).toBe(false)
    })
  })

  describe('mkSystemEvent', () => {
    it('creates an event with SYSTEM_USER_ID', () => {
      const event = mkSystemEvent('SystemTask', 'cmd-1', 'agg-1', { task: 'cleanup' })

      expect(event.userId).toBe(SYSTEM_USER_ID)
      expect(event._tag).toBe('SystemTask')
      expect(event.commandId).toBe('cmd-1')
      expect(event.aggregateId).toBe('agg-1')
      expect(event.isSystemEvent()).toBe(true)
    })
  })

  describe('mkSystemEventWithoutAggregate', () => {
    it('creates a system event without aggregate', () => {
      const event = mkSystemEventWithoutAggregate('SystemTask', 'cmd-1', { task: 'cleanup' })

      expect(event.userId).toBe(SYSTEM_USER_ID)
      expect(event.aggregateId).toBe(NO_AGGREGATE_ID)
      expect(event.isSystemEvent()).toBe(true)
      expect(event.hasAggregate()).toBe(false)
    })
  })

  describe('NO_AGGREGATE_ID', () => {
    it('is a string constant', () => {
      expect(typeof NO_AGGREGATE_ID).toBe('string')
      expect(NO_AGGREGATE_ID).toBe('__NO_AGGREGATE__')
    })
  })

  describe('SYSTEM_USER_ID', () => {
    it('is a string constant', () => {
      expect(typeof SYSTEM_USER_ID).toBe('string')
      expect(SYSTEM_USER_ID).toBe('__SYSTEM__')
    })
  })

  describe('showDomainEvent', () => {
    it('formats event with serializable payload', () => {
      const now = new Date('2024-01-01T12:00:00.000Z')
      vi.setSystemTime(now)

      const event = new DomainEvent('UserCreated', 'user-1', 'cmd-1', 'agg-1', { userId: '123' })
      const output = showDomainEvent(event)

      // Format: [timestamp] tag | cmd=cmdId agg=aggId evt=evtId usr=userId | payload
      expect(output).toContain('[2024-01-01T12:00:00.000Z]')
      expect(output).toContain('cmd=cmd-1')
      expect(output).toContain('agg=agg-1')
      expect(output).toContain('UserCreated')
      expect(output).toContain(`evt=${event.id}`)
      expect(output).toContain('{"userId":"123"}')
    })

    it('handles unserializable payload', () => {
      const circular: any = {}
      circular.self = circular

      const event = new DomainEvent('Test', 'user-1', 'cmd-1', 'agg-1', circular)
      const output = showDomainEvent(event)

      expect(output).toContain('[unserializable]')
      expect(output).toContain('Test')
    })

    it('uses dash for events without aggregate', () => {
      const event = new DomainEvent('Test', 'user-1', 'cmd-1', NO_AGGREGATE_ID, {})
      const output = showDomainEvent(event)

      expect(output).toContain('agg=-')
    })

    it('uses SYSTEM for system events', () => {
      const event = new DomainEvent('Test', SYSTEM_USER_ID, 'cmd-1', 'agg-1', {})
      const output = showDomainEvent(event)

      expect(output).toContain('usr=SYSTEM')
    })

    it('uses pipe separators for structured format', () => {
      const event = new DomainEvent('Test', 'user-1', 'cmd-1', 'agg-1', { foo: 'bar' })
      const output = showDomainEvent(event)

      // Format: [timestamp] tag | cmd=cmdId agg=aggId evt=evtId usr=userId | payload
      const parts = output.split(' | ')
      expect(parts.length).toBe(3)
      expect(parts[0]).toMatch(/^\[.+\] Test$/)
      expect(parts[1]).toContain('cmd=cmd-1')
      expect(parts[1]).toContain('agg=agg-1')
      expect(parts[1]).toContain('usr=user-1')
      expect(parts[2]).toBe('{"foo":"bar"}')
    })
  })

  describe('domainEventToJSON', () => {
    it('converts event to JSON-serializable object', () => {
      const now = new Date('2024-01-01T12:00:00.000Z')
      vi.setSystemTime(now)

      const event = new DomainEvent('UserCreated', 'user-1', 'cmd-1', 'agg-1', { userId: '123' })
      const json = domainEventToJSON(event)

      expect(json).toEqual({
        _tag: 'UserCreated',
        id: event.id,
        userId: 'user-1',
        commandId: 'cmd-1',
        aggregateId: 'agg-1',
        createdAt: '2024-01-01T12:00:00.000Z',
        payload: { userId: '123' },
      })
    })

    it('preserves payload structure', () => {
      const payload = {
        nested: {
          array: [1, 2, 3],
          bool: true,
        },
      }
      const event = new DomainEvent('Test', 'user-1', 'cmd-1', 'agg-1', payload)
      const json = domainEventToJSON(event)

      expect(json.payload).toEqual(payload)
    })

    it('converts date to ISO string', () => {
      const event = new DomainEvent('Test', 'user-1', 'cmd-1', 'agg-1', {})
      const json = domainEventToJSON(event)

      expect(typeof json.createdAt).toBe('string')
      expect(json.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe('matchDomainEvent', () => {
    it('matches event to corresponding handler', () => {
      const event = mkDomainEvent('UserCreated', 'user-1', 'cmd-1', 'agg-1', { userId: '123' })

      const result = matchDomainEvent(event, {
        UserCreated: (e) => `Created: ${e.payload.userId}`,
        UserDeleted: (e) => `Deleted: ${e.payload.userId}`,
      })

      expect(result).toBe('Created: 123')
    })

    it('calls default handler when no match found', () => {
      const event = mkDomainEvent('UnknownEvent', 'user-1', 'cmd-1', 'agg-1', {})

      const result = matchDomainEvent(
        event,
        {
          UserCreated: () => 'created',
        },
        (e) => `default: ${e._tag}`
      )

      expect(result).toBe('default: UnknownEvent')
    })

    it('throws error when no match and no default', () => {
      const event = mkDomainEvent('UnknownEvent', 'user-1', 'cmd-1', 'agg-1', {})

      expect(() => {
        matchDomainEvent(event, {
          UserCreated: () => 'created',
        })
      }).toThrow('Unhandled domain event tag: UnknownEvent')
    })

    it('returns handler result with different types', () => {
      const event = mkDomainEvent('Test', 'user-1', 'cmd-1', 'agg-1', {})

      const stringResult = matchDomainEvent(event, {
        Test: () => 'string',
      })

      const numberResult = matchDomainEvent(event, {
        Test: () => 42,
      })

      const objectResult = matchDomainEvent(event, {
        Test: () => ({ result: true }),
      })

      expect(stringResult).toBe('string')
      expect(numberResult).toBe(42)
      expect(objectResult).toEqual({ result: true })
    })

    it('passes event to handler', () => {
      const event = mkDomainEvent('Test', 'user-1', 'cmd-1', 'agg-1', { value: 100 })
      let receivedEvent: DomainEvent<any> | undefined

      matchDomainEvent(event, {
        Test: (e) => {
          receivedEvent = e
          return 'ok'
        },
      })

      expect(receivedEvent).toBe(event)
      expect(receivedEvent?.payload.value).toBe(100)
    })
  })
})
