import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  DomainEvent,
  mkDomainEvent,
  mkInitDomainEvent,
  INIT_AGGREGATE_ID,
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
      const payload = { userId: '123', name: 'Alice' }
      const event = new DomainEvent('UserCreated', 'cmd-1', 'agg-1', payload)

      expect(event._tag).toBe('UserCreated')
      expect(event.commandId).toBe('cmd-1')
      expect(event.aggregateId).toBe('agg-1')
      expect(event.payload).toEqual(payload)
      expect(event.id).toBeDefined()
      expect(event.id.length).toBeGreaterThan(0)
      expect(event.createdAt).toBeInstanceOf(Date)
    })

    it('generates unique IDs for different events', () => {
      const event1 = new DomainEvent('Test', 'cmd-1', 'agg-1', {})
      const event2 = new DomainEvent('Test', 'cmd-1', 'agg-1', {})

      expect(event1.id).not.toBe(event2.id)
    })

    it('preserves payload reference', () => {
      const payload = { nested: { value: 42 } }
      const event = new DomainEvent('Test', 'cmd-1', 'agg-1', payload)

      expect(event.payload).toBe(payload)
    })
  })

  describe('is', () => {
    it('returns true when tag matches', () => {
      const event = new DomainEvent('UserCreated', 'cmd-1', 'agg-1', {})

      expect(event.is('UserCreated')).toBe(true)
    })

    it('returns false when tag does not match', () => {
      const event = new DomainEvent('UserCreated', 'cmd-1', 'agg-1', {})

      expect(event.is('UserDeleted')).toBe(false)
    })

    it('is case-sensitive', () => {
      const event = new DomainEvent('UserCreated', 'cmd-1', 'agg-1', {})

      expect(event.is('usercreated')).toBe(false)
      expect(event.is('USERCREATED')).toBe(false)
    })
  })

  describe('mkDomainEvent', () => {
    it('creates an event using factory function', () => {
      const payload = { userId: '123' }
      const event = mkDomainEvent('UserCreated', 'cmd-1', 'agg-1', payload)

      expect(event).toBeInstanceOf(DomainEvent)
      expect(event._tag).toBe('UserCreated')
      expect(event.commandId).toBe('cmd-1')
      expect(event.aggregateId).toBe('agg-1')
      expect(event.payload).toEqual(payload)
    })

    it('handles different payload types', () => {
      const stringEvent = mkDomainEvent('String', 'cmd-1', 'agg-1', 'text')
      const numberEvent = mkDomainEvent('Number', 'cmd-1', 'agg-1', 42)
      const arrayEvent = mkDomainEvent('Array', 'cmd-1', 'agg-1', [1, 2, 3])
      const nullEvent = mkDomainEvent('Null', 'cmd-1', 'agg-1', null)

      expect(stringEvent.payload).toBe('text')
      expect(numberEvent.payload).toBe(42)
      expect(arrayEvent.payload).toEqual([1, 2, 3])
      expect(nullEvent.payload).toBe(null)
    })
  })

  describe('mkInitDomainEvent', () => {
    it('creates an event with INIT_AGGREGATE_ID', () => {
      const event = mkInitDomainEvent('UserCreated', 'cmd-1', { userId: '123' })

      expect(event.aggregateId).toBe(INIT_AGGREGATE_ID)
      expect(event._tag).toBe('UserCreated')
      expect(event.commandId).toBe('cmd-1')
    })

    it('uses special INIT_AGGREGATE_ID constant', () => {
      const event = mkInitDomainEvent('Test', 'cmd-1', {})

      expect(event.aggregateId).toBe('INIT_AGGREGATE_ID')
    })
  })

  describe('INIT_AGGREGATE_ID', () => {
    it('is a string constant', () => {
      expect(typeof INIT_AGGREGATE_ID).toBe('string')
      expect(INIT_AGGREGATE_ID).toBe('INIT_AGGREGATE_ID')
    })
  })

  describe('showDomainEvent', () => {
    it('formats event with serializable payload', () => {
      const now = new Date('2024-01-01T12:00:00.000Z')
      vi.setSystemTime(now)

      const event = new DomainEvent('UserCreated', 'cmd-1', 'agg-1', { userId: '123' })
      const output = showDomainEvent(event)

      expect(output).toContain('2024-01-01T12:00:00.000Z')
      expect(output).toContain('cmd-1')
      expect(output).toContain('agg-1')
      expect(output).toContain('UserCreated')
      expect(output).toContain(event.id)
      expect(output).toContain('{"userId":"123"}')
    })

    it('handles unserializable payload', () => {
      const circular: any = {}
      circular.self = circular

      const event = new DomainEvent('Test', 'cmd-1', 'agg-1', circular)
      const output = showDomainEvent(event)

      expect(output).toContain('[unserializable]')
      expect(output).toContain('Test')
    })

    it('pads tag to 12 characters', () => {
      const event = new DomainEvent('Short', 'cmd-1', 'agg-1', {})
      const output = showDomainEvent(event)

      // Extract tag part (4th segment after splitting by ::)
      const parts = output.split(' :: ')
      expect(parts[3]).toMatch(/^Short\s+$/)
      expect(parts[3].length).toBe(12)
    })

    it('formats with all components in correct order', () => {
      const event = new DomainEvent('Test', 'cmd-1', 'agg-1', {})
      const output = showDomainEvent(event)

      // Format: timestamp :: commandId :: aggregateId :: tag :: id => payload
      const parts = output.split(' :: ')
      expect(parts.length).toBe(5)
      expect(parts[1]).toBe('cmd-1')
      expect(parts[2]).toBe('agg-1')
    })
  })

  describe('domainEventToJSON', () => {
    it('converts event to JSON-serializable object', () => {
      const now = new Date('2024-01-01T12:00:00.000Z')
      vi.setSystemTime(now)

      const event = new DomainEvent('UserCreated', 'cmd-1', 'agg-1', { userId: '123' })
      const json = domainEventToJSON(event)

      expect(json).toEqual({
        _tag: 'UserCreated',
        id: event.id,
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
      const event = new DomainEvent('Test', 'cmd-1', 'agg-1', payload)
      const json = domainEventToJSON(event)

      expect(json.payload).toEqual(payload)
    })

    it('converts date to ISO string', () => {
      const event = new DomainEvent('Test', 'cmd-1', 'agg-1', {})
      const json = domainEventToJSON(event)

      expect(typeof json.createdAt).toBe('string')
      expect(json.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe('matchDomainEvent', () => {
    it('matches event to corresponding handler', () => {
      const event = mkDomainEvent('UserCreated', 'cmd-1', 'agg-1', { userId: '123' })

      const result = matchDomainEvent(event, {
        UserCreated: (e) => `Created: ${e.payload.userId}`,
        UserDeleted: (e) => `Deleted: ${e.payload.userId}`,
      })

      expect(result).toBe('Created: 123')
    })

    it('calls default handler when no match found', () => {
      const event = mkDomainEvent('UnknownEvent', 'cmd-1', 'agg-1', {})

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
      const event = mkDomainEvent('UnknownEvent', 'cmd-1', 'agg-1', {})

      expect(() => {
        matchDomainEvent(event, {
          UserCreated: () => 'created',
        })
      }).toThrow('Unhandled domain event tag: UnknownEvent')
    })

    it('returns handler result with different types', () => {
      const event = mkDomainEvent('Test', 'cmd-1', 'agg-1', {})

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
      const event = mkDomainEvent('Test', 'cmd-1', 'agg-1', { value: 100 })
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