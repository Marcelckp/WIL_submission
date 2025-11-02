# Event Loop Explained: Single vs Multi-Threaded Environments

## What is an Event Loop?

An **event loop** is a programming construct that enables a program to handle multiple operations concurrently without blocking the main execution thread. It continuously loops, checking for and processing events, tasks, and I/O operations.

### Core Concept

Think of an event loop like a waiter in a busy restaurant:

1. **Checks for new tasks** (customers ordering)
2. **Delegates blocking work** (cooks preparing food)
3. **Comes back to check** when work is ready
4. **Handles the result** (serves the food)
5. **Repeats** without blocking on any single operation

This pattern enables a single thread to manage thousands of concurrent operations efficiently.

---

## Understanding `await` and Yielding Control

### What Does "Voluntarily Yield Control" Mean?

When a coroutine encounters `await`, it doesn't mean the task runs "in the background". Instead:

**What Actually Happens:**

1. **`await` suspends the coroutine** - The current coroutine pauses and yields control back to the event loop
2. **The event loop continues** - Other coroutines can now run
3. **I/O is registered** - The event loop registers that it's waiting for I/O (network, disk, etc.)
4. **Later, when I/O completes** - The event loop resumes the suspended coroutine

### Visual Timeline

```text
Coroutine A:  print("A1") ─────── await sleep(1) ─────── print("A2")
                                                  │
Event Loop:   ───────────────────────────────────── [Wait, switch to B]
                                                  │
Coroutine B:                                    print("B1") ── print("B2")
                                                  │
Event Loop:                                        [Back to A]
                                                  │
Coroutine A:                                       print("A2")
```

**Key Point**: The coroutine is **paused** (not running), waiting for a signal that I/O is complete.

### Is the Task Running in the Background?

**No!** The coroutine code itself is **not running**. What's running is:

- **System-level I/O** - The OS kernel is handling network/disk operations
- **Other coroutines** - The event loop switches to other tasks
- **When I/O completes** - The OS notifies the event loop, which resumes your coroutine

### Code Example

```python
import asyncio
import time

async def task_with_delay(name, delay):
    print(f"{name}: Starting")
    await asyncio.sleep(delay)  # ← Yields control HERE
    print(f"{name}: Done")       # ← Resumes HERE later

async def main():
    start = time.time()

    # Both tasks "run concurrently"
    await asyncio.gather(
        task_with_delay("Task 1", 1),
        task_with_delay("Task 2", 1)
    )

    elapsed = time.time() - start
    print(f"Total time: {elapsed:.2f}s")
    # Output: ~1.00s (not 2s!)

asyncio.run(main())
```

**Why does this take ~1 second, not 2?**

- Both tasks start simultaneously
- Both hit `await asyncio.sleep(1)` and **pause**
- The event loop is waiting (doing nothing, checking for I/O completion)
- After 1 second, both complete and resume
- They run on the **same thread** but at different times

### The Event Loop as a Scheduler

Think of the event loop as a **smart scheduler**:

```text
Event Loop's TODO List:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
☐ Task A: waiting for network response
☐ Task B: waiting for file read
☐ Task C: Ready! → Execute print("Hello")
✓ Task C: Done
☐ Task D: Ready! → Execute calculation
✓ Task D: Done
☐ Task A: Network response received! → Resume
✓ Task A: Done
```

Tasks marked as "waiting" are **suspended** - their code isn't executing. The event loop checks the OS: "Is I/O ready yet?"

### Synchronous vs Asynchronous

```python
# SYNCHRONOUS (blocking)
def fetch_url(url):
    response = requests.get(url)  # ← STOPS everything for 2 seconds
    return response.text

# ASYNCHRONOUS (non-blocking)
async def fetch_url_async(url):
    response = await aiohttp.get(url)  # ← YIELDS control, continues
    return response.text  # ← Resumes here when ready
```

**The difference**: In async, your code yields control so **other code can run**. The I/O happens at the OS level while your code is paused.

### How the Event Loop is Notified (Technical Details)

Different languages use different mechanisms, but the core pattern is similar:

**1. I/O Completion Notification:**

- Modern operating systems provide **asynchronous I/O primitives** (e.g., `epoll`, `kqueue`, `IOCP`)
- When I/O completes, the OS sends an interrupt/event to the event loop
- The event loop **polls** these OS primitives to check for ready I/O

**2. Callback/Promise Queues:**

- When I/O completes, the associated callback/Promise resolver is queued
- Different queue priorities determine execution order
- The event loop processes these queues between phases

**3. Not Really "Background Tasks":**

- Your JavaScript/Python code is **suspended** (state saved)
- The **OS kernel** handles actual I/O
- When ready, kernel notifies event loop → callback queued → your code resumes

**Example Flow:**

```text
JavaScript: fetch('http://api.com')  ← Code suspends here
                    ↓
Node.js/libuv:  Registers socket with OS (epoll/kqueue)
                    ↓
OS Kernel:      Waits for network response (actual I/O)
                    ↓
OS:             "Data ready!" → Interrupts event loop
                    ↓
libuv:          Queues callback in pending callbacks
                    ↓
Event Loop:     Processes callback queue → Resumes JS code
                    ↓
JavaScript:     .then(response => ...) executes
```

---

## JavaScript/Node.js Event Loop

### Single-Threaded Architecture

Node.js uses a **single-threaded event loop** with a thread pool for blocking operations.

```text
┌─────────────────────────────────────────────────────────────┐
│                        JavaScript                            │
│                       (Single Thread)                        │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Event Loop (6 Phases)                   │    │
│  │  ┌─────────┐  ┌─────────┐  ┌────┐  ┌─────────┐     │    │
│  │  │ Timers  │→ │Pending  │→ │Poll │→ │ Check   │     │    │
│  │  │         │  │Callbacks│  │     │  │         │     │    │
│  │  └─────────┘  └─────────┘  └────┘  └─────────┘     │    │
│  │       ↑                               ↓             │    │
│  │       └────────── Close Callbacks ←──┘             │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                   │
└────────────────────── Thread Pool ──────────────────────────┘
                    (libuv - Worker Threads)
```

### Event Loop Phases

1. **Timers**: `setTimeout()`, `setInterval()` callbacks
2. **Pending Callbacks**: Deferred I/O callbacks
3. **Idle/Prepare**: Internal housekeeping
4. **Poll**: Fetch I/O events, execute I/O callbacks
5. **Check**: `setImmediate()` callbacks
6. **Close**: `socket.on('close')` callbacks

**Between each phase**: Process microtasks (Promises, `process.nextTick()`)

### JavaScript/Promise Execution Details

**In JavaScript, there are NO coroutines** - instead:

1. **Promises**: When you `await` a Promise, JavaScript creates a callback that gets queued
2. **Microtask Queue**: Promise callbacks go into a high-priority microtask queue
3. **Macrotask Queue**: `setTimeout`, I/O callbacks go into lower-priority macrotask queue
4. **Execution Order**:
   - Microtasks execute BETWEEN event loop phases
   - Macrotasks execute WITHIN event loop phases
   - `process.nextTick()` has even higher priority than Promises

**Promise State Machine:**

```text
fetch('/api') creates Promise
        ↓
Code suspends, callback queued in microtask queue
        ↓
Event loop continues, processes other microtasks
        ↓
Network I/O completes → libuv notifies
        ↓
Promise resolved → microtask queued
        ↓
Between phases → microtask executes → your code resumes
```

### Example

```javascript
console.log("Start");

setTimeout(() => console.log("Timeout"), 0);

Promise.resolve().then(() => console.log("Promise"));

setImmediate(() => console.log("Immediate"));

console.log("End");

// Output:
// Start
// End
// Promise      (microtask, runs first)
// Timeout       (timers phase)
// Immediate     (check phase)
```

### Limitations

- **Single thread for JavaScript code**: One operation blocks all others
- **CPU-bound tasks**: Need to offload to worker threads or child processes
- **Heavy computation**: Can starve the event loop

---

## Multi-Threaded Event Loops

### Why Multi-Thread?

Single-threaded event loops can be **CPU-bound limited**. Multi-threading adds:

- **Parallel CPU processing**
- **Better CPU core utilization**
- **Scalability for computation-heavy workloads**

---

## Java with Netty

### Architecture

Netty uses **Event Loop Groups** - multiple event loops, each on its own thread.

```text
┌─────────────────────────────────────────────────────────┐
│                  Netty Server                           │
│                                                         │
│  ┌─────────────────┐         ┌──────────────────┐       │
│  │ Boss Group      │         │  Worker Group    │       │
│  │ (1-2 threads)   │         │  (2*N threads)   │       │
│  │                 │         │                  │       │
│  │ ┌─────────────┐ │         │ ┌──────────────┐ │       │
│  │ │ Event Loop 1│ │         │ │ Event Loop 1 │ │       │
│  │ └─────────────┘ │         │ └──────────────┘ │       │
│  │                 │         │ ┌──────────────┐ │       │
│  │  Handles        │         │ │ Event Loop 2 │ │       │
│  │  new            │────────→│ └──────────────┘ │       │
│  │  connections    │         │ ┌──────────────┐ │       │
│  │                 │         │ │    ...       │ │       │
│  └─────────────────┘         │ └──────────────┘ │       │
│                              └──────────────────┘       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Netty Key Concepts

**Boss Group** (typically 1-2 threads):

- Accepts new connections
- Registers them with Worker Group

**Worker Group** (default: 2 × CPU cores):

- One thread per event loop
- Each loop handles multiple channels (connections)
- Non-blocking I/O operations

### Netty Example

```java
// Create event loop groups
EventLoopGroup bossGroup = new NioEventLoopGroup(1);    // Boss
EventLoopGroup workerGroup = new NioEventLoopGroup();   // Workers

ServerBootstrap bootstrap = new ServerBootstrap();
bootstrap.group(bossGroup, workerGroup)
         .channel(NioServerSocketChannel.class)
         .childHandler(new ChannelInitializer<SocketChannel>() {
             @Override
             protected void initChannel(SocketChannel ch) {
                 // Channel handlers run on worker group threads
             }
         });
```

### Netty Advantages

- **True parallelism**: Multiple threads process events simultaneously
- **CPU utilization**: Uses all available cores
- **Scalability**: Handles millions of connections
- **Known for**: High-performance, low-latency networking

---

## Rust with Tokio

### Tokio Architecture

Tokio uses a **multi-threaded work-stealing scheduler**.

```text
┌────────────────────────────────────────────────────────┐
│                    Tokio Runtime                       │
│                                                        │
│  ┌────────────────────────────────────────────────────┐│
│  │          Thread Pool (Default: CPU cores)          ││
│  │                                                    ││
│  │  Thread 1        Thread 2        Thread 3          ││
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐         ││
│  │  │ Task A  │    │ Task B  │    │ Task C  │         ││
│  │  │ Task D  │    │ Task E  │    │ Task F  │         ││
│  │  └─────────┘    └─────────┘    └─────────┘         ││
│  │     ↑              ↑              ↑                ││
│  │     └──────────────┴──────────────┘                ││
│  │              Work Stealing                         ││
│  │         (Move tasks between threads)               ││
│  └────────────────────────────────────────────────────┘│
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Tokio Key Features

**Work-Stealing Scheduler**:

- Tasks distributed across threads
- If a thread is idle, it "steals" work from busy threads
- Efficient CPU utilization

**System vs Runtime Threads**:

- **System threads**: Handle async I/O operations (blocking)
- **Runtime threads**: Execute async tasks (non-blocking)

### Tokio Example

```rust
#[tokio::main]
async fn main() {
    // Spawn multiple concurrent tasks
    let task1 = tokio::spawn(async {
        // Do async work
    });

    let task2 = tokio::spawn(async {
        // Do more async work
    });

    // Tokio distributes these across threads
    tokio::join!(task1, task2);
}
```

### Tokio Advantages

- **Zero-cost abstractions**: Minimal runtime overhead
- **Memory safety**: Compile-time guarantees (no data races)
- **Performance**: Near C-level speed with high-level abstractions
- **Modern concurrency**: Best of both worlds

---

## Python with asyncio

### asyncio Architecture

Python's `asyncio` uses a **single-threaded cooperative** event loop by default.

```text
┌────────────────────────────────────────────────────────┐
│              asyncio Event Loop                        │
│                  (Single Thread)                       │
│                                                        │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Coroutines (Cooperative Tasks)                   │ │
│  │                                                   │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │ │
│  │  │ Coro A   │→ │ Coro B   │→ │ Coro C   │→ ...    │ │
│  │  └──────────┘  └──────────┘  └──────────┘         │ │
│  │                                                   │ │
│  │  (Run one at a time, yield on await)              │ │
│  └───────────────────────────────────────────────────┘ │
│                                                        │
│                          ↓                             │
│                  Blocking I/O Operations               │
│              → Offload to Thread Pool                  │
└────────────────────────────────────────────────────────┘
```

### asyncio Key Concepts

**Cooperative Multitasking**:

- Coroutines voluntarily yield control with `await`
- No preemption - tasks must cooperate
- One blocking task blocks everything

**Solution for CPU-bound work**: Use `ProcessPoolExecutor` or threads

### Python Coroutines vs JavaScript Promises

**Python DOES use coroutines:**

1. **Coroutine Objects**: `async def` creates a coroutine (stateful, resumable)
2. **Generator Protocol**: Coroutines use Python's generator protocol internally
3. **State Preservation**: When you `await`, Python saves the current execution context (local variables, stack, etc.)
4. **Task Queue**: Coroutines are wrapped in Tasks and added to the event loop's task queue
5. **Ready Queue**: When I/O completes, the coroutine is moved to the ready queue and resumed

**Coroutine Lifecycle:**

```text
async def fetch(): creates coroutine object
      ↓
asyncio.create_task() wraps in Task
      ↓
Task added to event loop's pending queue
      ↓
await on I/O → coroutine suspension point
      ↓
Execution context saved (stack, locals)
      ↓
Coroutine yields control to event loop
      ↓
I/O completes → OS notifies event loop
      ↓
Coroutine moved to ready queue
      ↓
Event loop resumes coroutine from saved state
```

**Difference from JavaScript:**

- **Python**: True coroutines with state preservation and resumption
- **JavaScript**: Promise callbacks queued and executed later
- Both achieve similar async behavior, but Python's coroutines are more sophisticated

### asyncio Example

```python
import asyncio

async def fetch_data():
    print("Fetching...")
    await asyncio.sleep(1)  # Non-blocking sleep
    print("Done!")

async def main():
    # Run multiple coroutines concurrently
    await asyncio.gather(
        fetch_data(),
        fetch_data(),
        fetch_data()
    )

asyncio.run(main())
```

### asyncio Limitations

- **GIL (Global Interpreter Lock)**: Prevents true parallelism
- **Single-threaded by default**: Limited CPU utilization
- **Must offload**: Heavy CPU work requires process pools

---

## Comparison Table

| Language/Framework | Event Loop Model             | Threading            | Best For                              |
| ------------------ | ---------------------------- | -------------------- | ------------------------------------- |
| **Node.js**        | Single-threaded              | Thread pool for I/O  | I/O-bound workloads, APIs             |
| **Java/Netty**     | Multi-threaded groups        | Multiple event loops | High-performance networking           |
| **Rust/Tokio**     | Multi-threaded work-stealing | All CPU cores        | Systems programming, high concurrency |
| **Python/asyncio** | Single-threaded cooperative  | Thread/process pools | I/O-bound tasks, APIs                 |

---

## Key Takeaways

1. **Event loops enable concurrency** without traditional threading overhead
2. **Single-threaded** models excel at I/O-bound tasks (Node.js, asyncio)
3. **Multi-threaded** models better utilize CPUs (Netty, Tokio)
4. **Trade-offs exist**: Simplicity vs. performance vs. scalability
5. **Choose based on workload**: CPU-bound needs threads; I/O-bound may not

---

## When to Use What?

**Node.js**: Web APIs, real-time applications, microservices
**Netty**: High-throughput networking, proxy servers, game servers
**Tokio**: System services, databases, high-performance web servers
**asyncio**: Data processing, web scraping, API development (Python)
