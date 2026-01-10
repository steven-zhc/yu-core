/**
 * Data types and utilities for @yu/core
 *
 * This module provides fundamental functional programming data types
 * and typeclass implementations.
 */

// Patch - Three-state update semantics for PATCH operations
export type { Skip, Set, Clear, Patch } from './patch.js'
export {
  skip,
  set,
  clear,
  isSkip,
  isSet,
  isClear,
  applyPatch,
  of,
  toOptional,
  map,
  getOrElse,
  PatchTraversable,
} from './patch.js'

// Traversable - Typeclass for traversable data structures
export type { Applicative, Traversable } from './typeclass.js'
export { traverse } from './typeclass.js'
