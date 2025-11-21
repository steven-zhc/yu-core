/**
 * Optional key-value metadata carried by domain errors.
 * Use for structured diagnostics like { ms: 500, url: '...' }.
 */
export type ErrorMetadata = Record<string, unknown>

export class DomainError extends Error {
  readonly _tag: string
  readonly createdAt: Date
  _metadata?: ErrorMetadata

  constructor(tag: string, message: string, metadata?: ErrorMetadata) {
    super(message)
    this._tag = tag
    this.createdAt = new Date()
    if (metadata && Object.keys(metadata).length > 0) {
      this._metadata = { ...metadata }
    }
  }

  is(tag: string): boolean {
    return this._tag === tag
  }

  metadataWithDef<T>(key: string, def: T): T {
    if (!this._metadata || !Object.hasOwn(this._metadata, key)) {
      return def
    }
    const value = this._metadata[key]
    return value === undefined ? def : (value as T)
  }
}

export const isDomainError = (error: unknown): error is DomainError => error instanceof DomainError

export const mkDomainError = (tag: string, message: string, metadata?: ErrorMetadata): DomainError =>
  new DomainError(tag, message, metadata)

/**
 * Lightweight definition of a domain error kind.
 * Move shared error descriptors here so all packages can depend on it.
 */
export interface ErrorDefinition {
  tag: string
  defaultMessage: string
}

/**
 * Create a DomainError from a definition while overriding the message.
 * Falls back to the definition's default message when none is provided.
 */
export const mkDomainErrorWithReason = (
  def: ErrorDefinition,
  message?: string,
  metadata?: ErrorMetadata
): DomainError => mkDomainError(def.tag, message ?? def.defaultMessage, metadata)

/**
 * Create a DomainError from a shared ErrorDefinition with optional overrides.
 */
export const mkDomainErrorFrom = (def: ErrorDefinition, metadata?: ErrorMetadata): DomainError =>
  mkDomainError(def.tag, def.defaultMessage, metadata)

export const toDomainError =
  (tag: string) =>
  (err: unknown): DomainError => {
    if (typeof err === 'string') {
      return mkDomainError(tag, err)
    }
    if (err instanceof DomainError) {
      // If it's already a DomainError, keep its message but change tag and track the prior tag
      const existingTraceTags = err._metadata?.trace_tags
      const trace_tags = Array.isArray(existingTraceTags) ? [...existingTraceTags, err._tag] : [err._tag]
      return mkDomainError(tag, err.message, { ...err._metadata, trace_tags })
    }
    if (err instanceof Error) {
      // Convert vanilla Error to DomainError with new tag, use Error.message
      return mkDomainError(tag, err.message)
    }
    // For any other value (object, null, undefined, symbol, etc)
    try {
      return mkDomainError(tag, JSON.stringify(err))
    } catch {
      return mkDomainError(tag, String(err))
    }
  }

export const toDomainErrorWithDef =
  (def: ErrorDefinition, metadata?: ErrorMetadata) =>
  (error: unknown): DomainError => {
    const e = toDomainError(def.tag)(error)
    const suffix = ' << ' + def.defaultMessage
    return mkDomainError(def.tag, e.message + suffix, { ...e._metadata, ...metadata })
  }

// compare to toDomainError, mapToDomainError will not change or wrap error if err is DomainError.
export const mapToDomainError =
  (tag: string) =>
  (err: unknown): DomainError => {
    if (err instanceof DomainError) {
      return err
    }
    return toDomainError(tag)(err)
  }

// compare to toDomainErrorWithDef, mapToDomainError will not change or wrap error if err is DomainError.
export const mapToDomainErrorWithDef =
  (def: ErrorDefinition, metadata?: ErrorMetadata) =>
  (error: unknown): DomainError => {
    if (error instanceof DomainError) {
      return error
    }
    return toDomainErrorWithDef(def, metadata)(error)
  }

export const showDomainError = <T>(error: DomainError): string => {
  const meta = error._metadata
    ? ' :: ' +
      Object.entries(error._metadata)
        .map(([k, v]) => `${k} [${String(v)}]`)
        .join(' ')
    : ''
  return `${error.createdAt.toISOString()} :: ${error._tag.padEnd(15)} :: ${error.message}${meta}`
}

export const domainErrorToJSON = (error: DomainError) => {
  const base = {
    _tag: error._tag,
    message: error.message,
    createdAt: error.createdAt.toISOString(),
  }
  if (!error._metadata) {
    return base
  }
  return {
    ...base,
    metadata: { ...error._metadata },
  }
}
