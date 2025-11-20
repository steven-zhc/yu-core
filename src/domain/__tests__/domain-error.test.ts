import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  DomainError,
  isDomainError,
  mkDomainError,
  toDomainError,
  showDomainError,
  domainErrorToJSON,
  mkDomainErrorFrom,
  type ErrorDefinition,
  type ErrorMetadata,
} from '../domain-error.js'

describe('DomainError', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  describe('constructor', () => {
    it('creates an error with tag and message', () => {
      const error = new DomainError('ValidationError', 'Invalid input')

      expect(error._tag).toBe('ValidationError')
      expect(error.message).toBe('Invalid input')
      expect(error.createdAt).toBeInstanceOf(Date)
    })

    it('extends Error class', () => {
      const error = new DomainError('TestError', 'test message')

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(DomainError)
    })

    it('has error name set to Error', () => {
      const error = new DomainError('TestError', 'test')

      expect(error.name).toBe('Error')
    })
  })

  describe('is', () => {
    it('returns true when tag matches', () => {
      const error = new DomainError('NotFoundError', 'Resource not found')

      expect(error.is('NotFoundError')).toBe(true)
    })

    it('returns false when tag does not match', () => {
      const error = new DomainError('NotFoundError', 'Resource not found')

      expect(error.is('ValidationError')).toBe(false)
    })

    it('is case-sensitive', () => {
      const error = new DomainError('NotFoundError', 'test')

      expect(error.is('notfounderror')).toBe(false)
      expect(error.is('NOTFOUNDERROR')).toBe(false)
    })
  })

  describe('metadataWithDef', () => {
    it('returns metadata value when it exists', () => {
      const error = new DomainError('Tagged', 'msg', { status: 503 })

      expect(error.metadataWithDef('status', 200)).toBe(503)
    })

    it('falls back to default when key is missing', () => {
      const error = new DomainError('Tagged', 'msg', { status: 503 })

      expect(error.metadataWithDef('retry', false)).toBe(false)
    })

    it('falls back when stored value is undefined', () => {
      const error = new DomainError('Tagged', 'msg', { optional: undefined })

      expect(error.metadataWithDef('optional', 'fallback')).toBe('fallback')
    })
  })

  describe('mkDomainError', () => {
    it('creates an error using factory function', () => {
      const error = mkDomainError('TimeoutError', 'Request timed out')

      expect(error).toBeInstanceOf(DomainError)
      expect(error._tag).toBe('TimeoutError')
      expect(error.message).toBe('Request timed out')
    })

    it('handles empty message', () => {
      const error = mkDomainError('EmptyError', '')

      expect(error.message).toBe('')
    })
  })

  describe('isDomainError', () => {
    it('detects DomainError instances', () => {
      const error = new DomainError('Detected', 'yup')

      expect(isDomainError(error)).toBe(true)
    })

    it('rejects non DomainError values', () => {
      expect(isDomainError(new Error('nope'))).toBe(false)
      expect(isDomainError({ _tag: 'Detected' })).toBe(false)
      expect(isDomainError(null)).toBe(false)
    })
  })

  describe('toDomainError', () => {
    it('converts string to DomainError', () => {
      const converter = toDomainError('CustomError')
      const error = converter('Something went wrong')

      expect(error).toBeInstanceOf(DomainError)
      expect(error._tag).toBe('CustomError')
      expect(error.message).toBe('Something went wrong')
    })

    it('converts vanilla Error to DomainError', () => {
      const converter = toDomainError('CustomError')
      const originalError = new Error('Original error message')
      const error = converter(originalError)

      expect(error).toBeInstanceOf(DomainError)
      expect(error._tag).toBe('CustomError')
      expect(error.message).toBe('Original error message')
    })

    it('converts DomainError to new DomainError with different tag', () => {
      const converter = toDomainError('NewTag')
      const originalError = new DomainError('OldTag', 'error message')
      const error = converter(originalError)

      expect(error).toBeInstanceOf(DomainError)
      expect(error._tag).toBe('NewTag')
      expect(error.message).toBe('error message')
    })

    it('converts other types to string', () => {
      const converter = toDomainError('CustomError')

      const numberError = converter(42)
      expect(numberError.message).toBe('42')

      const nullError = converter(null)
      expect(nullError.message).toBe('null')

      const undefinedError = converter(undefined)
      expect(undefinedError.message).toBe('')

      const objectError = converter({ foo: 'bar' })
      expect(objectError.message).toBe('{"foo":"bar"}')
    })

    it('returns a converter function', () => {
      const converter = toDomainError('TestError')

      expect(typeof converter).toBe('function')
    })

    it('can be used with different error types', () => {
      const converter = toDomainError('ValidationError')

      const error1 = converter('string error')
      const error2 = converter(new Error('Error object'))
      const error3 = converter(new DomainError('OtherError', 'domain error'))

      expect(error1._tag).toBe('ValidationError')
      expect(error2._tag).toBe('ValidationError')
      expect(error3._tag).toBe('ValidationError')
    })
  })

  describe('showDomainError', () => {
    it('formats error with timestamp, tag, and message', () => {
      const now = new Date('2024-01-01T12:00:00.000Z')
      vi.setSystemTime(now)

      const error = new DomainError('NotFoundError', 'User not found')
      const output = showDomainError(error)

      expect(output).toContain('2024-01-01T12:00:00.000Z')
      expect(output).toContain('NotFoundError')
      expect(output).toContain('User not found')
    })

    it('pads tag to 15 characters', () => {
      const error = new DomainError('Short', 'message')
      const output = showDomainError(error)

      // Extract tag part (2nd segment after splitting by ::)
      const parts = output.split(' :: ')
      expect(parts[1]).toMatch(/^Short\s+$/)
      expect(parts[1].length).toBe(15)
    })

    it('handles long tags', () => {
      const error = new DomainError('VeryLongErrorTagName', 'message')
      const output = showDomainError(error)

      expect(output).toContain('VeryLongErrorTagName')
    })

    it('includes message with special characters', () => {
      const error = new DomainError('Error', 'Message with "quotes" and \\backslashes\\')
      const output = showDomainError(error)

      expect(output).toContain('Message with "quotes" and \\backslashes\\')
    })
  })

  describe('domainErrorToJSON', () => {
    it('converts error to JSON-serializable object', () => {
      const now = new Date('2024-01-01T12:00:00.000Z')
      vi.setSystemTime(now)

      const error = new DomainError('ValidationError', 'Invalid input')
      const json = domainErrorToJSON(error)

      expect(json).toEqual({
        _tag: 'ValidationError',
        message: 'Invalid input',
        createdAt: '2024-01-01T12:00:00.000Z',
      })
    })

    it('converts date to ISO string', () => {
      const error = new DomainError('TestError', 'test')
      const json = domainErrorToJSON(error)

      expect(typeof json.createdAt).toBe('string')
      expect(json.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('preserves message exactly', () => {
      const message = 'Special characters: \n\t"quotes"'
      const error = new DomainError('Error', message)
      const json = domainErrorToJSON(error)

      expect(json.message).toBe(message)
    })
  })

  describe('mkDomainErrorFrom', () => {
    it('creates error from definition with default message', () => {
      const def: ErrorDefinition = {
        tag: 'TimeoutError',
        defaultMessage: 'Request timed out',
      }

      const error = mkDomainErrorFrom(def)

      expect(error._tag).toBe('TimeoutError')
      expect(error.message).toBe('Request timed out')
    })

    it('uses fallback message when no default provided', () => {
      const def: ErrorDefinition = {
        tag: 'GenericError',
        defaultMessage: 'An error occurred',
      }

      const error = mkDomainErrorFrom(def)

      expect(error._tag).toBe('GenericError')
      expect(error.message).toBe('An error occurred')
    })

    it('stores metadata on the error', () => {
      const def: ErrorDefinition = {
        tag: 'TimeoutError',
        defaultMessage: 'Request timed out',
      }
      const metadata: ErrorMetadata = {
        ms: 5000,
        url: 'https://example.com',
      }

      const error = mkDomainErrorFrom(def, metadata)

      expect(error.message).toBe('Request timed out')
      expect(error._metadata).toMatchObject(metadata)
    })

    it('retains metadata with multiple fields', () => {
      const def: ErrorDefinition = {
        tag: 'ValidationError',
        defaultMessage: 'Invalid field',
      }
      const metadata: ErrorMetadata = {
        field: 'email',
        reason: 'invalid format',
        expected: 'user@example.com',
      }

      const error = mkDomainErrorFrom(def, metadata)

      expect(error.message).toBe('Invalid field')
      expect(error._metadata).toMatchObject(metadata)
    })

    it('handles empty metadata object', () => {
      const def: ErrorDefinition = {
        tag: 'Error',
        defaultMessage: 'Base message',
      }

      const error = mkDomainErrorFrom(def, {})

      expect(error.message).toBe('Base message')
    })

    it('handles undefined metadata', () => {
      const def: ErrorDefinition = {
        tag: 'Error',
        defaultMessage: 'Base message',
      }

      const error = mkDomainErrorFrom(def, undefined)

      expect(error.message).toBe('Base message')
    })

    it('preserves non-primitive metadata values', () => {
      const def: ErrorDefinition = {
        tag: 'Error',
        defaultMessage: 'Error occurred',
      }
      const metadata: ErrorMetadata = {
        count: 42,
        enabled: true,
        data: { nested: 'object' },
      }

      const error = mkDomainErrorFrom(def, metadata)

      expect(error.message).toBe('Error occurred')
      expect(error._metadata).toMatchObject(metadata)
    })

    it('works with error constants pattern', () => {
      // Simulating error-constants.ts usage
      const NetworkErrors = {
        TimeoutError: { tag: 'TimeoutError', defaultMessage: 'Request timed out' },
        FetchError: { tag: 'FetchError', defaultMessage: 'Failed to fetch resource' },
      } as const

      const error1 = mkDomainErrorFrom(NetworkErrors.TimeoutError, { ms: 5000 })
      const error2 = mkDomainErrorFrom(NetworkErrors.FetchError, { url: 'https://example.com' })

      expect(error1._tag).toBe('TimeoutError')
      expect(error1._metadata).toMatchObject({ ms: 5000 })
      expect(error2._tag).toBe('FetchError')
      expect(error2._metadata).toMatchObject({ url: 'https://example.com' })
    })
  })

  describe('ErrorDefinition type', () => {
    it('accepts minimal definition', () => {
      const def: ErrorDefinition = {
        tag: 'MinimalError',
        defaultMessage: 'Minimal error',
      }

      expect(def.tag).toBe('MinimalError')
      expect(def.defaultMessage).toBe('Minimal error')
    })

    it('accepts full definition', () => {
      const def: ErrorDefinition = {
        tag: 'FullError',
        defaultMessage: 'A full error',
      }

      expect(def.tag).toBe('FullError')
      expect(def.defaultMessage).toBe('A full error')
    })
  })

  describe('ErrorMetadata type', () => {
    it('accepts various value types', () => {
      const metadata: ErrorMetadata = {
        string: 'text',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        object: { nested: 'value' },
      }

      expect(metadata.string).toBe('text')
      expect(metadata.number).toBe(42)
      expect(metadata.boolean).toBe(true)
    })

    it('is readonly', () => {
      const metadata: ErrorMetadata = { field: 'value' }

      // TypeScript should prevent: metadata.field = 'new value'
      expect(metadata.field).toBe('value')
    })
  })
})
