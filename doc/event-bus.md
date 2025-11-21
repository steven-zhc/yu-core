# EventBus Architecture

The EventBus provides a pub/sub pattern for domain events with two distinct queue systems: **business event queues** and an **error event queue**.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          EventBus                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Business Event Queues (Multiple)          Error Queue (Single) │
│  ─────────────────────────────             ───────────────────  │
│                                                                 │
│  ┌─────────────────────┐                  ┌──────────────────┐  │
│  │ 'JobImported' Queue │                  │  __error_event__ │  │
│  │  - handler1         │                  │                  │  │
│  │  - handler2         │                  │  All handler     │  │
│  └─────────────────────┘                  │  errors go here  │  │
│                                           │                  │  │
│  ┌─────────────────────┐                  │  Filterable by   │  │
│  │ 'UserCreated' Queue │                  │  errorTag        │  │
│  │  - handler3         │                  └──────────────────┘  │
│  └─────────────────────┘                                        │
│                                                                 │
│  ┌─────────────────────┐                                        │
│  │ 'OrderPlaced' Queue │                                        │
│  │  - handler4         │                                        │
│  │  - handler5         │                                        │
│  └─────────────────────┘                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 1. Business Event Queues (Multiple Queues)

Business events are published and routed to handlers based on their **event tag** (`event._tag`). Each event tag has its own independent queue.

### Publishing Events

```typescript
// Publish a domain event
await eventBus.publish({
  _tag: 'JobImported',        // Event tag - determines routing
  id: 'event-123',
  commandId: 'cmd-456',
  aggregateId: 'job-789',
  occurredAt: new Date(),
  payload: { url: 'https://...' }
})
```

### Subscribing to Specific Events

```typescript
// Subscribe to specific event type
eventBus.subscribe('JobImported', (event) => {
  console.log('Job imported:', event.payload)
})

// Subscribe to another event type
eventBus.subscribe('UserCreated', (event) => {
  console.log('User created:', event.payload)
})

// Unsubscribe
const handler = (event) => { /* ... */ }
eventBus.subscribe('JobImported', handler)
eventBus.unsubscribe('JobImported', handler)
```

### Subscribing to All Events (Wildcard)

```typescript
// Subscribe to ALL events (useful for logging, monitoring)
eventBus.subscribeAll((event) => {
  console.log('[EVENT]', event._tag, event.payload)
})

// Unsubscribe from all
const wildcardHandler = (event) => { /* ... */ }
eventBus.subscribeAll(wildcardHandler)
eventBus.unsubscribeAll(wildcardHandler)
```

### Key Characteristics

- **Multiple queues**: Each event tag (`_tag`) has its own queue
- **Tag-based routing**: Events are routed to handlers by matching `event._tag`
- **Independent**: Handlers for different event tags are completely isolated
- **Wildcard support**: `subscribeAll()` receives all events across all queues

## 2. Error Event Queue (Single Queue with Filtering)

When a handler throws an error, it's caught and published to a **single internal error queue** (`__error_event__`). All handler errors go to this one queue, but can be filtered by **error tag**.

### Error Event Structure

```typescript
interface EventBusErrorEvent {
  eventTag: string       // Original business event tag (e.g., 'JobImported', 'ResumeGenerationQueued')
  errorTag: string       // Error type tag (e.g., 'LLMError', 'HallucinationDetectedError')
  event: DomainEvent     // The original event that was being processed
  error: DomainError     // The error that was thrown
}
```

The error event contains **two different tags** for flexible subscription:

- **`eventTag`** - The original business event's `_tag` (which handler threw the error)
  - Example: If a `ResumeGenerationQueued` handler fails, `eventTag = 'ResumeGenerationQueued'`
  - Use this to handle **all errors from a specific use case/workflow**

- **`errorTag`** - The domain error's `_tag` (what kind of error occurred)
  - Example: If an LLM API call fails, `errorTag = 'LLMError'`
  - Use this to handle **specific error types across your entire system**

### Subscribing to ALL Errors

```typescript
// Subscribe to ALL handler errors from any event type and any error type
eventBus.subscribeErrors((errorEvent) => {
  console.error('Handler error:')
  console.error('  Business event:', errorEvent.eventTag)  // Which use case
  console.error('  Error type:', errorEvent.errorTag)      // What error
  console.error('  Error:', errorEvent.error)
  console.error('  Original event:', errorEvent.event)
})
```

### Subscribing by Business Event (Use Case Errors)

Filter errors by **which handler** failed - useful for use case-specific error handling:

```typescript
// Handle all errors from 'ResumeGenerationQueued' handlers
eventBus.subscribeErrorsByEventTag('ResumeGenerationQueued', (errorEvent) => {
  console.error('Resume generation failed:', errorEvent.error)
  console.error('Error type:', errorEvent.errorTag)  // Could be LLMError, HallucinationDetectedError, etc.

  // Use case-specific error handling
  // - Update job resume status to 'failed'
  // - Send notification to user
  // - Retry with exponential backoff
})

// Handle all errors from 'JobImported' handlers
eventBus.subscribeErrorsByEventTag('JobImported', (errorEvent) => {
  console.error('Job import failed:', errorEvent.error)
  // This catches ALL error types (network, parsing, validation, etc.)
})
```

### Subscribing by Error Type (Cross-Cutting Error Handling)

Filter errors by **what kind of error** occurred - useful for handling specific error types across your entire system:

```typescript
// Handle ALL LLM errors regardless of which handler threw them
eventBus.subscribeErrorsByErrorTag('LLMError', (errorEvent) => {
  console.error('LLM API error occurred')
  console.error('  In handler:', errorEvent.eventTag)  // Which use case failed
  console.error('  Error:', errorEvent.error)

  // Cross-cutting LLM error handling
  // - Log to monitoring service
  // - Check API rate limits
  // - Alert on-call engineer if rate exceeds threshold
})

// Handle ALL hallucination detection errors
eventBus.subscribeErrorsByErrorTag('HallucinationDetectedError', (errorEvent) => {
  console.error('AI hallucination detected')
  console.error('  In handler:', errorEvent.eventTag)

  // Track hallucination frequency
  // - Log for LLM prompt tuning
  // - Adjust temperature/parameters
})

// Handle ALL network/timeout errors
eventBus.subscribeErrorsByErrorTag('NetworkError', (errorEvent) => {
  // Retry logic for network issues across all use cases
})
```

### Unsubscribing from Errors

```typescript
// Unsubscribe from all errors
const errorHandler = (err) => { /* ... */ }
eventBus.subscribeErrors(errorHandler)
eventBus.unsubscribeErrors(errorHandler)

// Unsubscribe from errors by business event
eventBus.subscribeErrorsByEventTag('JobImported', errorHandler)
eventBus.unsubscribeErrorsByEventTag('JobImported', errorHandler)

// Unsubscribe from errors by error type
eventBus.subscribeErrorsByErrorTag('LLMError', errorHandler)
eventBus.unsubscribeErrorsByErrorTag('LLMError', errorHandler)
```

### Key Characteristics

- **Single queue**: All handler errors go to one internal queue (`__error_event__`)
- **Dual filtering**: Subscribe to all errors OR filter by:
  - **`eventTag`** (which use case/handler failed) - use case-specific error handling
  - **`errorTag`** (what error type occurred) - cross-cutting error handling by error type
- **Non-blocking**: Errors don't abort other handlers or stop event processing
- **Isolated**: Business event handlers and error handlers are independent

## Error Handling Flow

```
1. Event Published (e.g., 'ResumeGenerationQueued')
   ↓
2. Handler Executes
   ↓
3. Handler Throws Error (e.g., LLM API fails)
   ↓
4. Error Caught by EventBus
   ↓
5. Wrapped as EventBusErrorEvent
   {
     eventTag: 'ResumeGenerationQueued',  // Business event tag
     errorTag: 'LLMError',                // Error type tag
     event: originalEvent,
     error: domainError
   }
   ↓
6. Published to __error_event__ queue
   ↓
7. Delivered to Error Subscribers (all that match):
   ├─ subscribeErrors() handlers receive it (all errors)
   ├─ subscribeErrorsByEventTag('ResumeGenerationQueued') handlers receive it
   └─ subscribeErrorsByErrorTag('LLMError') handlers receive it
```

## Example: Complete Usage

```typescript
import { createEventBus } from '@yu/core/domain'

const eventBus = createEventBus()

// 1. Subscribe to business events
eventBus.subscribe('JobImported', async (event) => {
  console.log('Processing job:', event.payload.url)

  // This might throw an error
  await processJob(event.payload)
})

eventBus.subscribe('ResumeGenerationQueued', async (event) => {
  console.log('Generating resume for:', event.payload.jobId)

  // This might also throw
  await generateResume(event.payload)
})

// 2. Subscribe to ALL errors (global error monitoring)
eventBus.subscribeErrors((errorEvent) => {
  logger.error('Handler failed', {
    businessEvent: errorEvent.eventTag,  // Which use case
    errorType: errorEvent.errorTag,      // What error
    error: errorEvent.error,
    eventId: errorEvent.event.id
  })
})

// 3. Subscribe by business event (use case-specific error handling)
eventBus.subscribeErrorsByEventTag('ResumeGenerationQueued', async (errorEvent) => {
  // Handle ALL errors from resume generation, regardless of error type
  console.error('Resume generation failed:', errorEvent.error)
  console.error('Error type:', errorEvent.errorTag)

  // Update database to mark as failed
  await markJobResumeAsFailed(
    errorEvent.event.aggregateId,
    errorEvent.error
  )
})

// 4. Subscribe by error type (cross-cutting error handling)
eventBus.subscribeErrorsByErrorTag('LLMError', async (errorEvent) => {
  // Handle ALL LLM errors across the entire system
  console.error('LLM API error in:', errorEvent.eventTag)

  // Check if we're hitting rate limits
  await checkLLMRateLimits()

  // Alert if error rate is high
  await alertIfHighErrorRate('LLM')
})

// 5. Wildcard subscription for audit trail
eventBus.subscribeAll((event) => {
  auditLog.record(event)
})

// 6. Publish events
await eventBus.publish(jobImportedEvent)
await eventBus.publish(resumeGenerationQueuedEvent)
```

## Implementation Notes

### Internal Queue Names

- **Business events**: Each event tag is its own queue (e.g., `'JobImported'`, `'UserCreated'`)
- **Error events**: Single queue with internal name `'__error_event__'`

### Handler Wrapping

All handlers are wrapped to:
1. Catch errors and prevent them from aborting other handlers
2. Convert errors to `EventBusErrorEvent` with both `eventTag` (business event) and `errorTag` (error type)
3. Publish errors to the error queue

### Filtering Mechanism

The EventBus provides **two independent filtering mechanisms**:

**1. Filter by Business Event (`subscribeErrorsByEventTag`)**
- Filters by `errorEvent.eventTag` (which handler failed)
- Wraps handler: `if (errorEvent.eventTag === eventTag) { ... }`
- Use for: Use case-specific error handling

**2. Filter by Error Type (`subscribeErrorsByErrorTag`)**
- Filters by `errorEvent.errorTag` (what error occurred)
- Wraps handler: `if (errorEvent.errorTag === errorTag) { ... }`
- Use for: Cross-cutting error handling by error type

Both subscribe the wrapped handler to the single `__error_event__` queue and only execute when their respective tag matches. This is more efficient than having handlers do manual filtering.

### Memory Management

- Uses `WeakMap` for handler storage to allow garbage collection
- Handlers are automatically cleaned up when references are lost
- Proper unsubscribe cleans up internal mappings

## Use Cases

### Business Event Queues

- **Domain event handlers**: React to business events (job imported, user created, order placed)
- **Saga orchestration**: Multi-step workflows triggered by events
- **Read model updates**: Update denormalized views when aggregates change
- **Notifications**: Send emails, push notifications based on events
- **Integration**: Publish to external systems when events occur

### Error Event Queue

**By Business Event (Use Case-Specific):**
- **Workflow error handling**: Handle all errors in a specific use case (e.g., resume generation)
- **Use case retry logic**: Retry specific workflows with backoff
- **Workflow monitoring**: Track failure rates per use case
- **User notifications**: Notify users when their request fails

**By Error Type (Cross-Cutting):**
- **LLM error handling**: Handle all LLM API errors across the system
- **Rate limiting**: Track and respond to rate limit errors globally
- **Network resilience**: Retry all network errors with exponential backoff
- **Error type alerting**: Alert when specific error types spike
- **Error type analytics**: Track which errors occur most frequently

**All Errors (Global):**
- **Global error logging**: Log all handler failures to monitoring system
- **Dead letter queue**: Move all failed events to DLQ after max retries
- **System health monitoring**: Track overall error rates
- **Debugging**: Analyze handler failure patterns across the system

## Best Practices

1. **Keep handlers focused**: Each handler should do one thing well
2. **Handle errors gracefully**: Don't let one handler's error affect others
3. **Use error subscriptions**: Don't ignore handler failures - monitor them
4. **Choose the right filter**:
   - Use `subscribeErrorsByEventTag()` for use case-specific error handling
   - Use `subscribeErrorsByErrorTag()` for cross-cutting error handling by type
   - Use both if you need both perspectives
5. **Clean up subscriptions**: Always unsubscribe when done (especially in tests)
6. **Async handlers**: Handlers can be async - EventBus handles promises properly
7. **Idempotency**: Design handlers to be idempotent in case of retries
8. **Tag errors properly**: Ensure your DomainErrors have meaningful `_tag` values for filtering
