/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Traversable Protocol
 *
 * Emulates Haskell's Traversable typeclass in TypeScript.
 * Since TypeScript lacks Higher-Kinded Types (HKT), we use a "witness" pattern
 * where traversable operations are passed as objects.
 *
 * Haskell signature: traverse :: (Traversable t, Applicative f) => (a -> f b) -> t a -> f (t b)
 *
 * Note: Traverse requires Applicative (pure, map), not full Monad (flatMap).
 */

/**
 * Applicative witness - provides the Applicative operations needed for traverse
 *
 * In Haskell:
 * ```haskell
 * class Functor f => Applicative f where
 *   pure :: a -> f a
 *   fmap :: (a -> b) -> f a -> f b
 * ```
 *
 * @example
 * ```typescript
 * const EffectApplicative: Applicative = {
 *   pure: Effect.succeed,
 *   map: Effect.map,
 * }
 * ```
 */
export interface Applicative {
  /**
   * Lift a value into the Applicative context
   * Haskell: pure :: a -> f a
   */
  pure: <A>(value: A) => any

  /**
   * Map a function over the Applicative
   * Haskell: fmap :: (a -> b) -> f a -> f b
   */
  map: <A, B>(fa: any, f: (a: A) => B) => any
}

/**
 * Traversable witness - provides traverse implementation for a type
 *
 * Note: Due to TypeScript's lack of Higher-Kinded Types (HKT), we can't properly
 * express the container type constructor. In Haskell it would be:
 * ```haskell
 * class Traversable t where
 *   traverse :: Applicative f => (a -> f b) -> t a -> f (t b)
 * ```
 *
 * We use a witness pattern instead, where the implementation knows the concrete type.
 *
 * @example
 * ```typescript
 * const PatchTraversable: Traversable = {
 *   traverse: (applicative) => (f) => (patch) => {
 *     // implementation using applicative.pure and applicative.map
 *     // The concrete types Patch<A> and Patch<B> are known here
 *   }
 * }
 * ```
 */
export interface Traversable {
  /**
   * Traverse with an applicative function
   *
   * Haskell: traverse :: Applicative f => (a -> f b) -> t a -> f (t b)
   *
   * @param applicative - Applicative instance for the target functor
   * @returns Curried function: (a -> f b) -> t a -> f (t b)
   *
   * The concrete types for `t` (container) are determined by the implementation.
   */
  traverse: <A>(applicative: Applicative) => (f: (value: A) => any) => (container: any) => any
}

/**
 * Generic traverse function that works with any Traversable instance
 *
 * Requires both a Traversable instance (for the container) and an Applicative instance (for the effect type).
 *
 * @param instance - Traversable witness for the container type
 * @param applicative - Applicative witness for the effect type
 * @returns Curried traverse function: (f: a => f b) -> (container: t a) => f (t b)
 *
 * @example
 * ```typescript
 * import { traverse, PatchTraversable, EffectApplicative } from '@yu/core/traversable'
 * import { pipe } from 'effect/Function'
 *
 * // Generic traverse - provide both instances:
 * yield* pipe(
 *   patch,
 *   traverse(PatchTraversable, EffectApplicative)(UrlValue.from)
 * )
 *
 * // Or create specialized versions:
 * const traversePatchWithEffect = traverse(PatchTraversable, EffectApplicative)
 * yield* pipe(patch, traversePatchWithEffect(UrlValue.from))
 * ```
 */
export const traverse =
  (instance: Traversable, applicative: Applicative) =>
  <A>(f: (value: A) => any) =>
  (container: any): any =>
    instance.traverse<A>(applicative)(f)(container)
