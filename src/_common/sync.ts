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

export const None: Option<any> = {
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
    async unlock(): Promise<void> {
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
    async unlock(): Promise<void> {
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
    private globalLock: Mutex
    private readerLock: Mutex
    private reader: number
    constructor() {
        this.globalLock = new Mutex()
        this.readerLock = new Mutex()
        this.reader = 0
    }

    async lock(): Promise<void> {
        await this.globalLock.lock()
    }
    async unlock(): Promise<void> {
        await this.globalLock.unlock()
    }
    async withLock<T>(f: () => Promise<T>): Promise<T> {
        return this.globalLock.withLock(f)
    }

    async lockRead(): Promise<void> {
        await this.readerLock.withLock(async () => {
            this.reader += 1
            if (this.reader === 1) {
                await this.globalLock.lock()
            }
        })
    }
    async unlockRead(): Promise<void> {
        await this.readerLock.withLock(async () => {
            this.reader -= 1
            if (this.reader === 0) {
                await this.globalLock.unlock()
            }
        })
    }
    async withReadLock<T>(f: () => Promise<T>): Promise<T> {
        await this.lockRead()
        try {
            return await f()
        } finally {
            this.unlockRead()
        }
    }
}

export class Condition {
    /*
    Usage:
    const cond = new Condition(new Mutex());
    const thread1 = async () => {
        await cond.lock();
        while (true) {
            await cond.wait();
        }
        await cond.unlock();
    }
    const thread2 = async () => {
        await cond.lock();
        cond.signal();
        await cond.unlock();
    }
    */
    private mutex: Mutex
    private queue: Deferred[]
    constructor(mutex: Mutex) {
        this.mutex = mutex
        this.queue = []
    }

    async lock(): Promise<void> {
        await this.mutex.lock()
    }
    async unlock(): Promise<void> {
        await this.mutex.unlock()
    }
    async withLock<T>(f: () => Promise<T>): Promise<T> {
        return this.mutex.withLock(f)
    }

    async wait(): Promise<void> {
        const d = new Deferred()
        this.queue.push(d)
        await this.mutex.unlock()
        await d.promise
        await this.mutex.lock()
    }
    signal(): void {
        if (this.queue.length > 0) {
            const d = this.queue.shift()!
            d.resolve()
        }
    }
    broadcast(): void {
        const prevQueue = this.queue
        this.queue = []
        prevQueue.forEach((d) => d.resolve())
    }
}

///

export class Channel<T = unknown> {
    private capacity: number
    private closed: boolean
    private mailbox: T[]
    private cond: Condition
    constructor(capacity: number) {
        if (capacity <= 0) throw new Error("capacity must greater than 0")
        this.capacity = capacity
        this.closed = false
        this.mailbox = []
        this.cond = new Condition(new Mutex())
    }

    close() {
        this.closed = true
        this.cond.broadcast()
    }
    isClosed(): boolean {
        return this.closed
    }

    async send(data: T): Promise<boolean> {
        if (this.closed) return false
        await this.cond.withLock(async () => {
            while (this.mailbox.length === this.capacity) {
                await this.cond.wait()
            }
            this.mailbox.push(data)
            await this.cond.signal()
        })
        return true
    }
    async receive(): Promise<Option<T>> {
        return this.cond.withLock(async () => {
            while (this.mailbox.length === 0) {
                if (this.closed) {
                    return None
                } else {
                    await this.cond.wait()
                }
            }
            const x = this.mailbox.shift()!
            this.cond.signal()
            return Some(x)
        })
    }
}
export const ChanUtil = {
    async sendAll<T>(ch: Channel<T>, xs: T[]) {
        for (const x of xs) {
            await ch.send(x)
        }
    },
    async createWorker<T>(
        ch: Channel<T>,
        cb: (x: T) => Promise<void>,
        n: number = 1,
    ) {
        const startWorker = async <T>(
            ch: Channel<T>,
            cb: (x: T) => Promise<void>,
        ) => {
            while (true) {
                const x = await ch.receive()
                if (x.isSome) {
                    await cb(x.getExn())
                } else {
                    return
                }
            }
        }
        const workers: Promise<void>[] = []
        for (let i = 0; i < n; i++) {
            workers.push(startWorker(ch, cb))
        }
        await Promise.all(workers)
    },
}
