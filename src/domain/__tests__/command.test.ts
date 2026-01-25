import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Command, mkCommand, showCommand, cmdToJSON } from '../command.js'

describe('Command', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  describe('constructor', () => {
    it('creates a command with tag, userId and payload', () => {
      const payload = { action: 'create' }
      const cmd = new Command('CreateUser', 'user-123', payload)

      expect(cmd._tag).toBe('CreateUser')
      expect(cmd.userId).toBe('user-123')
      expect(cmd.payload).toEqual(payload)
      expect(cmd.id).toBeDefined()
      expect(cmd.id.length).toBeGreaterThan(0)
      expect(cmd.createdAt).toBeInstanceOf(Date)
    })

    it('generates unique IDs for different commands', () => {
      const cmd1 = new Command('TestCommand', 'user-1', { foo: 1 })
      const cmd2 = new Command('TestCommand', 'user-1', { foo: 1 })

      expect(cmd1.id).not.toBe(cmd2.id)
    })

    it('preserves payload reference', () => {
      const payload = { nested: { value: 42 } }
      const cmd = new Command('Test', 'user-1', payload)

      expect(cmd.payload).toBe(payload)
    })
  })

  describe('is', () => {
    it('returns true when tag matches', () => {
      const cmd = new Command('CreateUser', 'user-1', {})

      expect(cmd.is('CreateUser')).toBe(true)
    })

    it('returns false when tag does not match', () => {
      const cmd = new Command('CreateUser', 'user-1', {})

      expect(cmd.is('DeleteUser')).toBe(false)
    })

    it('is case-sensitive', () => {
      const cmd = new Command('CreateUser', 'user-1', {})

      expect(cmd.is('createuser')).toBe(false)
      expect(cmd.is('CREATEUSER')).toBe(false)
    })
  })

  describe('mkCommand', () => {
    it('creates a command using factory function', () => {
      const payload = { name: 'Alice' }
      const cmd = mkCommand('CreateUser', 'user-123', payload)

      expect(cmd).toBeInstanceOf(Command)
      expect(cmd._tag).toBe('CreateUser')
      expect(cmd.userId).toBe('user-123')
      expect(cmd.payload).toEqual(payload)
    })

    it('handles different payload types', () => {
      const stringCmd = mkCommand('StringCmd', 'user-1', 'text')
      const numberCmd = mkCommand('NumberCmd', 'user-1', 42)
      const arrayCmd = mkCommand('ArrayCmd', 'user-1', [1, 2, 3])
      const nullCmd = mkCommand('NullCmd', 'user-1', null)

      expect(stringCmd.payload).toBe('text')
      expect(numberCmd.payload).toBe(42)
      expect(arrayCmd.payload).toEqual([1, 2, 3])
      expect(nullCmd.payload).toBe(null)
    })
  })

  describe('showCommand', () => {
    it('formats command with serializable payload and userId', () => {
      const now = new Date('2024-01-01T12:00:00.000Z')
      vi.setSystemTime(now)

      const cmd = new Command('CreateUser', 'user-123', { name: 'Alice' })
      const output = showCommand(cmd)

      // Format: [timestamp] tag | cmd=id usr=userId | payload
      expect(output).toContain('[2024-01-01T12:00:00.000Z]')
      expect(output).toContain('CreateUser')
      expect(output).toContain(`cmd=${cmd.id}`)
      expect(output).toContain('usr=user-123')
      expect(output).toContain('{"name":"Alice"}')
    })

    it('handles unserializable payload', () => {
      const circular: any = {}
      circular.self = circular

      const cmd = new Command('TestCmd', 'user-1', circular)
      const output = showCommand(cmd)

      expect(output).toContain('[unserializable]')
      expect(output).toContain('TestCmd')
    })

    it('uses pipe separators for structured format', () => {
      const cmd = new Command('TestCmd', 'user-1', { foo: 'bar' })
      const output = showCommand(cmd)

      // Format: [timestamp] tag | cmd=id usr=userId | payload
      const parts = output.split(' | ')
      expect(parts.length).toBe(3)
      expect(parts[0]).toMatch(/^\[.+\] TestCmd$/)
      expect(parts[1]).toContain('cmd=')
      expect(parts[1]).toContain('usr=')
      expect(parts[2]).toBe('{"foo":"bar"}')
    })

    it('handles empty payload', () => {
      const cmd = new Command('EmptyCmd', 'user-1', {})
      const output = showCommand(cmd)

      expect(output).toContain('{}')
    })
  })

  describe('cmdToJSON', () => {
    it('converts command to JSON-serializable object with userId', () => {
      const now = new Date('2024-01-01T12:00:00.000Z')
      vi.setSystemTime(now)

      const cmd = new Command('CreateUser', 'user-123', { name: 'Alice' })
      const json = cmdToJSON(cmd)

      expect(json).toEqual({
        _tag: 'CreateUser',
        id: cmd.id,
        userId: 'user-123',
        createdAt: '2024-01-01T12:00:00.000Z',
        payload: { name: 'Alice' },
      })
    })

    it('preserves payload structure', () => {
      const payload = {
        nested: {
          array: [1, 2, 3],
          bool: true,
        },
      }
      const cmd = new Command('ComplexCmd', 'user-1', payload)
      const json = cmdToJSON(cmd)

      expect(json.payload).toEqual(payload)
    })

    it('converts date to ISO string', () => {
      const cmd = new Command('Test', 'user-1', {})
      const json = cmdToJSON(cmd)

      expect(typeof json.createdAt).toBe('string')
      expect(json.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })
})
