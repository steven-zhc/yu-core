import { DomainEvent } from '../domain/index.js'

export abstract class AggregateRoot<TId = string> {
  readonly id: TId
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected _events: Array<DomainEvent<any>>

  protected constructor(id: TId) {
    this.id = id
    this._events = []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record(event: DomainEvent<any>): void {
    this._events.push(event)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchEvents(): ReadonlyArray<DomainEvent<any>> {
    return this._events
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pullEvents(): Array<DomainEvent<any>> {
    const out = this._events
    this._events = []
    return out
  }

  equals(other: { id: TId }): boolean {
    return this.id === other.id
  }
}
