/**
 * Common functional programming data types for @yu/core
 *
 * This module provides fundamental FP data types for common patterns.
 */

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
 * Type guard: Check if update is Set or Clear
 */
export const isUpdate = <T>(update: Patch<T>): update is Set<T> | Clear => isSet(update) || isClear(update)

/**
 * Pattern match on a Patch value
 *
 * @param handlers - Object with handlers for each case
 * @returns A function that takes a Patch and returns the result
 *
 * @example
 * ```typescript
 * const patch = set('hello')
 * const result = match({
 *   onSkip: () => 'no change',
 *   onSet: (value) => `set to ${value}`,
 *   onClear: () => 'cleared'
 * })(patch)
 * // result: 'set to hello'
 * ```
 */
export const match =
  <T, R>(handlers: { onSkip: () => R; onSet: (value: T) => R; onClear: () => R }) =>
  (patch: Patch<T>): R => {
    switch (patch._tag) {
      case 'Skip':
        return handlers.onSkip()
      case 'Set':
        return handlers.onSet(patch.value)
      case 'Clear':
        return handlers.onClear()
    }
  }

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
export const applyPatch = <T>(update: Patch<T> | undefined, current: T | undefined): T | null => {
  if (!update) return current

  switch (update._tag) {
    case 'Skip':
      return current
    case 'Set':
      return update.value
    case 'Clear':
      return null
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
 * of(undefined)  // skip()
 * of(null)       // clear()
 * of('hello')    // set('hello')
 * ```
 */
export const of = <T>(value: T | null | undefined): Patch<T> => {
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
 * map(x => x * 2)(set(5))     // set(10)
 * map(x => x * 2)(skip())     // skip()
 * map(x => x * 2)(clear())    // clear()
 * ```
 */
export const map =
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
 * getOrElse('default')(set('hello'))   // 'hello'
 * getOrElse('default')(skip())         // 'default'
 * getOrElse('default')(clear())        // 'default'
 * ```
 */
export const getOrElse =
  <T>(defaultValue: T) =>
  (update: Patch<T>): T => {
    return isSet(update) ? update.value : defaultValue
  }

/**
 * Traversable instance for Patch
 *
 * Allows generic traverse operations on Patch values using any Applicative functor.
 * This emulates Haskell's Traversable typeclass in TypeScript.
 *
 * Works with any Applicative (Effect, Option, Array, etc.) - not hardcoded to Effect!
 *
 * @example
 * ```typescript
 * import { traverse, EffectApplicative } from '@yu/core/traversable'
 * import { PatchTraversable } from '@yu/core'
 * import { pipe } from 'effect/Function'
 *
 * // Generic traverse with Applicative witness:
 * yield* pipe(
 *   patch,
 *   traverse(PatchTraversable, EffectApplicative)(UrlValue.from)
 * )
 * ```
 */
export const PatchTraversable = {
  traverse:
    <A, B>(applicative: any) =>
    (f: (value: A) => any) =>
    (patch: Patch<A>): any => {
      // Use the provided Applicative's operations (pure and map)
      switch (patch._tag) {
        case 'Skip':
          return applicative.pure(skip()) // pure :: a -> f a
        case 'Clear':
          return applicative.pure(clear()) // pure :: a -> f a
        case 'Set':
          return applicative.map(f(patch.value), (result: B) => set(result)) // fmap :: (a -> b) -> f a -> f b
      }
    },
}
