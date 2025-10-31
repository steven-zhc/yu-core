import { nanoid } from 'nanoid'
import { INIT_AGGREGATE_ID } from './domain-event.js'
import type { Domain } from 'domain'

export class DomainError extends Error {
  readonly _tag: string
  readonly createdAt: Date

  constructor(
    tag: string,
    message: string,
  ) {
    super(message)
    this._tag = tag
    this.createdAt = new Date()
  }

  is(tag: string): boolean {
    return this._tag === tag
  }
}

export const mkDomainError = (
  tag: string,
  message: string,
): DomainError => {
  return new DomainError(tag, message)
}

export const toDomainError = (tag: string ) => (err: unknown): DomainError => {
  if (typeof err === 'string') {
    return mkDomainError(tag, err)
  }
  if (err instanceof DomainError) {
    // If it's already a DomainError, keep its message but change tag
    return mkDomainError(tag, err.message)
  }
  if (err instanceof Error && typeof err.message === 'string') {
    // Convert vanilla Error to DomainError with new tag, use Error.message
    return mkDomainError(tag, err.message)
  }
  // For any other value (object, null, undefined, symbol, etc)
  return mkDomainError(tag, String(err))

}

export const showDomainError = <T>(error: DomainError): string => {
  return `${error.createdAt.toISOString()} :: ${error._tag.padEnd(12)} :: ${error.message}`
}

export const domainErrorToJSON = (error: DomainError) => ({
  _tag: error._tag,
  message: error.message,
  createdAt: error.createdAt.toISOString(),
})
