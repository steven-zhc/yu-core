export const NetworkError = {
  UnknownError: {
    tag: 'unknown-network-error',
    defaultMessage: 'an unknown network error occurred',
  },
  TimeoutError: {
    tag: 'timeout-error',
    defaultMessage: 'request timed out',
  },
}

export const SystemErrors = {
  UnknownError: {
    tag: 'unknown-system-error',
    defaultMessage: 'an unknown system error occurred',
  },
  ConfigurationError: {
    tag: 'configuration-error',
    defaultMessage: 'system configuration error',
  },
  DatabaseError: {
    tag: 'database-error',
    defaultMessage: 'database operation failed',
  },
  InternalError: {
    tag: 'internal-error',
    defaultMessage: 'internal server error',
  },
} as const

export const ResourceError = {
  UnknownError: {
    tag: 'unknown-resource-error',
    defaultMessage: 'an unknown resource error occurred',
  },
  NotFoundError: {
    tag: 'not-found-error',
    defaultMessage: 'resource not found',
  },
  UnauthorizedError: {
    tag: 'unauthorized-error',
    defaultMessage: 'authentication required',
  },
  ForbiddenError: {
    tag: 'forbidden-error',
    defaultMessage: 'access forbidden',
  },
} as const

export const ValidationError = {
  UnknownError: {
    tag: 'unknown-validation-error',
    defaultMessage: 'an unknown validation error occurred',
  },
  InvalidUrlError: {
    tag: 'invalid-url-error',
    defaultMessage: 'invalid url format',
  },
  InvalidInputError: {
    tag: 'invalid-input-error',
    defaultMessage: 'invalid input provided',
  },
} as const

export const EventBusError = {
  UnknownError: {
    tag: 'unknown-event-bus-error',
    defaultMessage: 'an unknown event bus error',
  },
}
