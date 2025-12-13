/**
 * Common functional programming data types for @yu/core
 *
 * This module provides fundamental FP data types for common patterns.
 */

/**
 * Patch<T> - Represents three states for field updates in PATCH operations
 *
 * States:
 * - Skip: Leave the field unchanged (don't modify)
 * - Set<T>: Update the field to a new value
 * - Clear: Clear/wipe/empty the field (set to null/undefined)
 *
 * @example
 * ```typescript
 * import { Patch, skip, set, clear, applyPatch } from '@yu/core'
 *
 * interface User {
 *   name: string
 *   email: string | undefined
 *   bio: string | undefined
 * }
 *
 * interface UserPatch {
 *   name?: Patch<string>
 *   email?: Patch<string>
 *   bio?: Patch<string>
 * }
 *
 * const user: User = { name: 'Alice', email: 'alice@example.com', bio: 'Hello' }
 *
 * const patch: UserPatch = {
 *   name: skip(),           // Keep current name
 *   email: set('new@example.com'),  // Update email
 *   bio: clear()            // Clear bio
 * }
 *
 * // Apply patches
 * user.name = applyPatch(patch.name, user.name)   // 'Alice'
 * user.email = applyPatch(patch.email, user.email) // 'new@example.com'
 * user.bio = applyPatch(patch.bio, user.bio)       // undefined
 * ```
 */
export type Patch<T> = Skip | Set<T> | Clear

/**
 * Skip - Leave the field unchanged
 */
export type Skip = {
  readonly _tag: 'Skip'
}

/**
 * Set<T> - Update the field to a new value
 */
export type Set<T> = {
  readonly _tag: 'Set'
  readonly value: T
}

/**
 * Clear - Clear/wipe/empty the field
 */
export type Clear = {
  readonly _tag: 'Clear'
}

/**
 * Constructor: Create a Skip update (leave field unchanged)
 */
export const skip = (): Skip => ({ _tag: 'Skip' })

/**
 * Constructor: Create a Set update (set field to value)
 */
export const set = <T>(value: T): Set<T> => ({ _tag: 'Set', value })

/**
 * Constructor: Create a Clear update (clear field)
 */
export const clear = (): Clear => ({ _tag: 'Clear' })

/**
 * Type guard: Check if update is Skip
 */
export const isSkip = <T>(update: Patch<T>): update is Skip => update._tag === 'Skip'

/**
 * Type guard: Check if update is Set
 */
export const isSet = <T>(update: Patch<T>): update is Set<T> => update._tag === 'Set'

/**
 * Type guard: Check if update is Clear
 */
export const isClear = <T>(update: Patch<T>): update is Clear => update._tag === 'Clear'

/**
 * Apply a Patch to a current value
 *
 * @param update - The update to apply
 * @param current - The current value
 * @returns The new value after applying update
 *
 * @example
 * ```typescript
 * applyPatch(skip(), 'current')        // 'current'
 * applyPatch(set('new'), 'current')    // 'new'
 * applyPatch(clear(), 'current')       // undefined
 * ```
 */
export const applyPatch = <T>(update: Patch<T> | undefined, current: T | undefined): T | undefined => {
  if (!update) return current

  switch (update._tag) {
    case 'Skip':
      return current
    case 'Set':
      return update.value
    case 'Clear':
      return undefined
  }
}

/**
 * Convert optional field semantics (undefined/null/value) to Patch
 *
 * Convention:
 * - undefined => Skip (field not provided in update)
 * - null => Clear (explicit clear)
 * - value => Set(value) (explicit set)
 *
 * @example
 * ```typescript
 * fromOptional(undefined)  // skip()
 * fromOptional(null)       // clear()
 * fromOptional('hello')    // set('hello')
 * ```
 */
export const fromOptional = <T>(value: T | null | undefined): Patch<T> => {
  if (value === undefined) return skip()
  if (value === null) return clear()
  return set(value)
}

/**
 * Convert Patch to optional field semantics (undefined/null/value)
 *
 * @example
 * ```typescript
 * toOptional(skip())         // undefined
 * toOptional(clear())        // null
 * toOptional(set('hello'))   // 'hello'
 * ```
 */
export const toOptional = <T>(update: Patch<T>): T | null | undefined => {
  switch (update._tag) {
    case 'Skip':
      return undefined
    case 'Set':
      return update.value
    case 'Clear':
      return null
  }
}

/**
 * Map a function over a Patch value
 *
 * @example
 * ```typescript
 * mapPatch(set(5), x => x * 2)     // set(10)
 * mapPatch(skip(), x => x * 2)     // skip()
 * mapPatch(clear(), x => x * 2)    // clear()
 * ```
 */
export const mapPatch =
  <T, U>(f: (value: T) => U) =>
  (update: Patch<T>): Patch<U> => {
    if (isSet(update)) {
      return set(f(update.value))
    }
    if (isClear(update)) {
      return clear()
    }
    return skip()
  }

/**
 * Get the value from a Patch, or return a default
 *
 * @example
 * ```typescript
 * getOrElse(set('hello'), 'default')   // 'hello'
 * getOrElse(skip(), 'default')         // 'default'
 * getOrElse(clear(), 'default')        // 'default'
 * ```
 */
export const getOrElse =
  <T>(defaultValue: T) =>
  (update: Patch<T>): T => {
    return isSet(update) ? update.value : defaultValue
  }
