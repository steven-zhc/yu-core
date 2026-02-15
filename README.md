# @yu/core (yu-core)

A small **DDD + eventing** core library for TypeScript.

It provides a few opinionated building blocks that tend to be re‑implemented in every DDD codebase:

- **Commands** (with ids + timestamps)
- **Domain events** (correlation ids, aggregate ids, system events)
- **Event bus** (pub/sub with structured error channel)
- **Aggregate root** base class (record/pull events)
- A tiny **Patch** type for 3‑state update semantics (skip/set/clear)

> Repo: https://github.com/steven-zhc/yu-core

## Install

```bash
npm i @yu/core
# or
pnpm add @yu/core
```

Node requirement: **>= 22** (see `package.json#engines`).

## Imports

```ts
import { Command, mkCommand } from "@yu/core/domain";
import { DomainEvent, mkDomainEvent } from "@yu/core/domain";
import { EmitteryEventBus } from "@yu/core/domain";

import { AggregateRoot } from "@yu/core/state-sourcing";

import { Patch, skip, set, clear, applyPatch } from "@yu/core/data";
```

## Usage

### Command

```ts
import { mkCommand } from "@yu/core/domain";

type CreateUser = { email: string };

const cmd = mkCommand<CreateUser>("CreateUser", "user_123", { email: "a@b.com" });
// cmd.id, cmd.createdAt, cmd.userId, cmd.payload
```

### DomainEvent

```ts
import { mkDomainEvent, mkSystemEvent } from "@yu/core/domain";

type UserCreated = { userId: string; email: string };

const evt = mkDomainEvent<UserCreated>(
  "UserCreated",
  "user_123",          // who initiated
  "cmd_abc",           // command id (correlation)
  "user_456",          // aggregate id
  { userId: "user_456", email: "a@b.com" },
);

const sysEvt = mkSystemEvent("ReindexStarted", "cmd_maintenance", "agg_1", { reason: "cron" });
```

### EventBus

```ts
import { EmitteryEventBus, mkSystemEvent } from "@yu/core/domain";

const bus = new EmitteryEventBus();

bus.subscribe("UserCreated", async (event) => {
  // handle
});

bus.subscribeErrors((err) => {
  // structured error channel (eventTag + errorTag + event + error)
  // good place for logging/metrics
});

await bus.publish(mkSystemEvent("UserCreated", "cmd_1", "user_1", { email: "a@b.com" }));
```

### AggregateRoot (state-sourcing)

```ts
import { AggregateRoot } from "@yu/core/state-sourcing";
import { mkDomainEvent } from "@yu/core/domain";

class UserAggregate extends AggregateRoot<string> {
  static create(id: string) {
    const agg = new UserAggregate(id);
    agg.record(mkDomainEvent("UserCreated", "user_123", "cmd_1", id, { id }));
    return agg;
  }
}

const a = UserAggregate.create("user_1");
const eventsToPersist = a.pullEvents();
```

### Patch (skip / set / clear)

Useful when you want `PATCH` semantics where the absence of a field means “do nothing”.

```ts
import { Patch, skip, set, clear, applyPatch } from "@yu/core/data";

type User = { name: string; bio?: string | null };

type UserPatch = {
  name?: Patch<string>;
  bio?: Patch<string>;
};

const u: User = { name: "Alice", bio: "Hello" };
const p: UserPatch = { name: skip(), bio: clear() };

u.name = applyPatch(p.name, u.name) ?? u.name;
u.bio = applyPatch(p.bio, u.bio) as any;
```

## Scripts (repo)

```bash
npm run lint
npm test
npm run build
```

## License

Apache-2.0
