export class Deferred<T = void> {
    promise: Promise<T>
    // @ts-ignore
    resolve: (payload: T) => void
    // @ts-ignore
    reject: (err: Error) => void
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve
            this.reject = reject
        })
    }
}

///

export interface Option<T> {
    isNone: boolean
    isSome: boolean
    getExn(): T
    map<K>(f: (x: T) => K): Option<K>
    bind<K>(f: (x: T) => Option<K>): Option<K>
}

export const None: Option<never> = {
    isNone: true,
    isSome: false,
    getExn: () => {
        throw new Error("Option.getExn")
    },
    map: (_) => None,
    bind: (_) => None,
}

export const Some = <T>(x: T): Option<T> => ({
    isNone: false,
    isSome: true,
    getExn: () => x,
    map: (f) => Some(f(x)),
    bind: (f) => f(x),
})

///

export const sleep = async (ms: number) =>
    new Promise<void>((resolve) => {
        setTimeout(() => resolve(), ms)
    })

///

export class Mutex {
    /*
    Usage:
    const lock = new Mutex();
    await lock.withLock(async () => console.log('locked'));
    */
    private locked: boolean
    private queue: Deferred[]
    constructor() {
        this.locked = false
        this.queue = []
    }
    async lock(): Promise<void> {
        if (this.locked) {
            const d = new Deferred()
            this.queue.push(d)
            await d.promise
        } else {
            this.locked = true
        }
    }
    tryLock(): boolean {
        if (this.locked) {
            return false
        } else {
            this.locked = true
            return true
        }
    }
    unlock(): void {
        if (this.locked) {
            if (this.queue.length === 0) {
                this.locked = false
            } else {
                const next = this.queue.shift()!
                next.resolve()
            }
        }
    }
    async withLock<T>(f: () => Promise<T>): Promise<T> {
        await this.lock()
        try {
            return await f()
        } finally {
            this.unlock()
        }
    }
}

export class Semaphore {
    /*
    Usage:
    const lock = new Semaphore(2);
    await lock.withLock(async () => console.log('locked'));
    */
    private capacity: number
    private used: number
    private queue: Deferred[]
    constructor(capacity: number) {
        if (capacity <= 0) throw new Error("capacity must greater than 0")
        this.capacity = capacity
        this.used = 0
        this.queue = []
    }
    async lock(): Promise<void> {
        if (this.used >= this.capacity) {
            const d = new Deferred()
            this.queue.push(d)
            await d.promise
        } else {
            this.used += 1
        }
    }
    tryLock(): boolean {
        if (this.used >= this.capacity) {
            return false
        } else {
            this.used += 1
            return true
        }
    }
    unlock(): void {
        if (this.used > 0) {
            if (this.queue.length === 0) {
                this.used -= 1
            } else {
                const next = this.queue.shift()!
                next.resolve()
            }
        }
    }
    async withLock<T>(f: () => Promise<T>): Promise<T> {
        await this.lock()
        try {
            return await f()
        } finally {
            this.unlock()
        }
    }
}

export class RWLock {
    // read-preferring read-write-lock
    private writeLock: Mutex
    private readerLock: Mutex
    private reader: number
    constructor() {
        this.writeLock = new Mutex()
        this.readerLock = new Mutex()
        this.reader = 0
    }
    lockWrite(): Promise<void> {
        return this.writeLock.lock()
    }
    unlockWrite(): void {
        return this.writeLock.unlock()
    }
    withWriteLock<T>(f: () => Promise<T>): Promise<T> {
        return this.writeLock.withLock(f)
    }

    lockRead(): Promise<void> {
        return this.readerLock.withLock(async () => {
            this.reader += 1
            if (this.reader === 1) {
                await this.writeLock.lock()
            }
        })
    }
    unlockRead(): Promise<void> {
        return this.readerLock.withLock(async () => {
            this.reader -= 1
            if (this.reader === 0) {
                await this.writeLock.unlock()
            }
        })
    }
    async withReadLock<T>(f: () => Promise<T>): Promise<T> {
        await this.lockRead()
        try {
            return await f()
        } finally {
            await this.unlockRead()
        }
    }
}

export class Condition {
    /*
    Usage:
    const lock = new Mutex()
    const cond = new Condition();
    let someTest = false
    const thread1 = (async () => {
        await lock.lock();
        while (!someTest) {
            await cond.wait(lock);
        }
        console.log("done")
        lock.unlock();
    })();
    const thread2 = (async () => {
        await sleep(1000);
        await lock.lock();
        someTest = true;
        cond.signal();
        lock.unlock();
    })();
    */
    private queue: Deferred[]
    constructor() {
        this.queue = []
    }
    async wait(mutex: Mutex): Promise<void> {
        const d = new Deferred()
        this.queue.push(d)
        await mutex.unlock()
        await d.promise // waiting for `signal/broadcast`
        await mutex.lock()
    }
    signal(): void {
        if (this.queue.length > 0) {
            const d = this.queue.shift()!
            d.resolve()
        }
    }
    broadcast(): void {
        if (this.queue.length > 0) {
            this.queue.forEach((d) => d.resolve())
            this.queue = []
        }
    }
}

export class Barrier {
    /*
    Usage:
    const barrier = new Barrier(5);
    for (let i = 0; i < 10; i++) {
        setTimeout(async () => {
            console.log("before wait");
            await barrier.wait();
            console.log("after wait");
        });
    }
    */
    private next: number
    private target: number
    private queue: Deferred[]
    constructor(n: number) {
        this.next = 1
        this.target = n
        this.queue = []
    }
    async wait(): Promise<void> {
        if (this.next === this.target) {
            this.queue.forEach((d) => d.resolve())
            // reset
            this.queue = []
            this.next = 1
        } else {
            this.next++
            const d = new Deferred()
            this.queue.push(d)
            await d.promise
        }
    }
}

export class Once {
    /*
    Usage:
    const once = new Once();
    once.do(() => console.log("init"));
    console.log(init.isCompleted());
    */
    private completed: boolean
    constructor() {
        this.completed = false
    }
    do(fn: Function) {
        if (this.completed) return
        this.completed = true
        fn()
    }
    isCompleted(): boolean {
        return this.completed
    }
}

export class Channel<T = unknown> {
    /*
    Usage:
    const chan = new Channel<number>();
    chan.send(10);
    const box = await chan.receive();
    const msg = box.getExn()
    chan.close()
    */
    private readers: Deferred<Option<T>>[]
    private writers: [T, Deferred<boolean>][]
    private closed: boolean
    constructor() {
        this.readers = []
        this.writers = []
        this.closed = false
    }
    close() {
        this.closed = true
        this.readers.forEach((r) => r.resolve(None))
        this.readers = []
        this.writers.forEach(([_, w]) => w.resolve(false))
        this.writers = []
    }
    isClosed(): boolean {
        return this.closed
    }
    // true means the message is sent to a reader
    // false means the channel closed and the data is discarded
    async send(data: T): Promise<boolean> {
        if (this.closed) return false
        if (this.readers.length > 0) {
            const r = this.readers.shift()!
            r.resolve(Some(data))
            return true
        } else {
            const w = new Deferred<boolean>()
            this.writers.push([data, w])
            return w.promise
        }
    }
    // Some(T) means we receive a message from a writer
    // None means the channel is closed
    async receive(): Promise<Option<T>> {
        if (this.closed) return None
        if (this.writers.length > 0) {
            const [data, w] = this.writers.shift()!
            w.resolve(true)
            return Some(data)
        } else {
            const r = new Deferred<Option<T>>()
            this.readers.push(r)
            return r.promise
        }
    }
}

// don't close a channel from the receiver side
// don't close a channel if the channel has multiple concurrent senders
// by Go101
export class BufferedChannel<T = unknown> {
    private readers: Deferred<Option<T>>[]
    private writers: [T, Deferred<boolean>][]
    private closed: boolean
    private capacity: number
    private buffer: T[]
    constructor(capacity: number) {
        if (!(Number.isSafeInteger(capacity) && capacity > 0)) {
            throw new Error(
                "the buffer capacity must be a safe integer and greater than 0",
            )
        }
        this.capacity = capacity
        this.buffer = []
        this.readers = []
        this.writers = []
        this.closed = false
    }
    close() {
        this.closed = true
        this.readers.forEach((r) => r.resolve(None))
        this.readers = []
        this.writers.forEach(([_, w]) => w.resolve(false))
        this.writers = []
    }
    isClosed(): boolean {
        return this.closed
    }
    isDrained(): boolean {
        if (!this.closed) return false
        return this.buffer.length === 0
    }
    async send(data: T): Promise<boolean> {
        if (this.closed) return false
        if (this.readers.length > 0) {
            // assert(this.buffer.length === 0)
            const r = this.readers.shift()!
            r.resolve(Some(data))
            return true
        } else if (this.buffer.length < this.capacity) {
            this.buffer.push(data)
            return true
        } else {
            const w = new Deferred<boolean>()
            this.writers.push([data, w])
            return w.promise
        }
    }
    async receive(): Promise<Option<T>> {
        if (this.buffer.length > 0) {
            const data = this.buffer.shift()!
            if (this.writers.length > 0) {
                const [data, w] = this.writers.shift()!
                w.resolve(true)
                this.buffer.push(data)
            }
            return Some(data)
        } else {
            // assert(this.writers.length === 0)
            if (this.closed) {
                return None
            } else {
                const r = new Deferred<Option<T>>()
                this.readers.push(r)
                return r.promise
            }
        }
    }
}

///

export const ChanUtil = {
    async sendAll<T>(ch: Channel<T>, xs: T[]) {
        for (const x of xs) {
            await ch.send(x)
        }
    },
    async createWorker<T>(
        chan: Channel<T>,
        cb: (x: T) => Promise<void>,
        n: number = 1,
    ) {
        const startWorker = async <T>(
            chan: Channel<T>,
            cb: (x: T) => Promise<void>,
        ) => {
            while (true) {
                const x = await chan.receive()
                if (x.isSome) {
                    await cb(x.getExn())
                } else {
                    return
                }
            }
        }
        const workers: Promise<void>[] = []
        for (let i = 0; i < n; i++) {
            workers.push(startWorker(chan, cb))
        }
        await Promise.all(workers)
    },
}
