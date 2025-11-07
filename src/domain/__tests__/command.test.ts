import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Command, mkCommand, showCommand, cmdToJSON } from '../command.js'

describe('Command', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  describe('constructor', () => {
    it('creates a command with tag and payload', () => {
      const payload = { userId: '123', action: 'create' }
      const cmd = new Command('CreateUser', payload)

      expect(cmd._tag).toBe('CreateUser')
      expect(cmd.payload).toEqual(payload)
      expect(cmd.id).toBeDefined()
      expect(cmd.id.length).toBeGreaterThan(0)
      expect(cmd.createdAt).toBeInstanceOf(Date)
    })

    it('generates unique IDs for different commands', () => {
      const cmd1 = new Command('TestCommand', { foo: 1 })
      const cmd2 = new Command('TestCommand', { foo: 1 })

      expect(cmd1.id).not.toBe(cmd2.id)
    })

    it('preserves payload reference', () => {
      const payload = { nested: { value: 42 } }
      const cmd = new Command('Test', payload)

      expect(cmd.payload).toBe(payload)
    })
  })

  describe('is', () => {
    it('returns true when tag matches', () => {
      const cmd = new Command('CreateUser', {})

      expect(cmd.is('CreateUser')).toBe(true)
    })

    it('returns false when tag does not match', () => {
      const cmd = new Command('CreateUser', {})

      expect(cmd.is('DeleteUser')).toBe(false)
    })

    it('is case-sensitive', () => {
      const cmd = new Command('CreateUser', {})

      expect(cmd.is('createuser')).toBe(false)
      expect(cmd.is('CREATEUSER')).toBe(false)
    })
  })

  describe('mkCommand', () => {
    it('creates a command using factory function', () => {
      const payload = { name: 'Alice' }
      const cmd = mkCommand('CreateUser', payload)

      expect(cmd).toBeInstanceOf(Command)
      expect(cmd._tag).toBe('CreateUser')
      expect(cmd.payload).toEqual(payload)
    })

    it('handles different payload types', () => {
      const stringCmd = mkCommand('StringCmd', 'text')
      const numberCmd = mkCommand('NumberCmd', 42)
      const arrayCmd = mkCommand('ArrayCmd', [1, 2, 3])
      const nullCmd = mkCommand('NullCmd', null)

      expect(stringCmd.payload).toBe('text')
      expect(numberCmd.payload).toBe(42)
      expect(arrayCmd.payload).toEqual([1, 2, 3])
      expect(nullCmd.payload).toBe(null)
    })
  })

  describe('showCommand', () => {
    it('formats command with serializable payload', () => {
      const now = new Date('2024-01-01T12:00:00.000Z')
      vi.setSystemTime(now)

      const cmd = new Command('CreateUser', { userId: '123' })
      const output = showCommand(cmd)

      expect(output).toContain('2024-01-01T12:00:00.000Z')
      expect(output).toContain('CreateUser')
      expect(output).toContain(cmd.id)
      expect(output).toContain('{"userId":"123"}')
    })

    it('handles unserializable payload', () => {
      const circular: any = {}
      circular.self = circular

      const cmd = new Command('TestCmd', circular)
      const output = showCommand(cmd)

      expect(output).toContain('[unserializable]')
      expect(output).toContain('TestCmd')
    })

    it('pads tag to 12 characters', () => {
      const cmd = new Command('Short', {})
      const output = showCommand(cmd)

      // Tag should be padded: "Short       "
      const lines = output.split(' :: ')
      expect(lines[1]).toMatch(/^Short\s+$/)
      expect(lines[1].length).toBe(12)
    })

    it('handles empty payload', () => {
      const cmd = new Command('EmptyCmd', {})
      const output = showCommand(cmd)

      expect(output).toContain('{}')
    })
  })

  describe('cmdToJSON', () => {
    it('converts command to JSON-serializable object', () => {
      const now = new Date('2024-01-01T12:00:00.000Z')
      vi.setSystemTime(now)

      const cmd = new Command('CreateUser', { userId: '123' })
      const json = cmdToJSON(cmd)

      expect(json).toEqual({
        _tag: 'CreateUser',
        id: cmd.id,
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
      const cmd = new Command('ComplexCmd', payload)
      const json = cmdToJSON(cmd)

      expect(json.payload).toEqual(payload)
    })

    it('converts date to ISO string', () => {
      const cmd = new Command('Test', {})
      const json = cmdToJSON(cmd)

      expect(typeof json.createdAt).toBe('string')
      expect(json.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })
})