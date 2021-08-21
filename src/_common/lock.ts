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

interface Locker {
    lock(): Promise<void>
    unlock(): Promise<void>
    withLock<T>(f: () => Promise<T>): Promise<T>
}

export class Lock implements Locker {
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

export class Semaphore implements Locker {
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
