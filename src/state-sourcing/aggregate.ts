import { DomainEvent } from '../domain/domain-event.js'

export abstract class AggregateRoot<TId = string> {
  readonly id: TId
  protected _events: Array<DomainEvent<any>>

  protected constructor(id: TId) {
    this.id = id
    this._events = []
  }

  protected record(event: DomainEvent<any>): void {
    this._events.push(event)
  }

  fetchEvents(): ReadonlyArray<DomainEvent<any>> {
    return this._events
  }

  pullEvents(): Array<DomainEvent<any>> {
    const out = this._events
    this._events = []
    return out
  }

  equals(other: { id: TId }): boolean {
    return this.id === other.id
  }
}

