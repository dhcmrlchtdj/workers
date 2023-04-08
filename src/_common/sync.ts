import { Deferred } from "./deferred.js"
import { type Option, some, none } from "./option.js"

///

export const sleep = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(() => resolve(), ms))

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
	async withLock<T>(f: () => T | Promise<T>): Promise<T> {
		await this.lock()
		try {
			return await f()
		} finally {
			this.unlock()
		}
	}
}

export class CondMutex {
	/*
	Usage:
	const lock = new CondMutex();

	await lock.withLock(async () => {
		console.log('before')
		await lock.waitUntil(() => blah());
		console.log('after')
	});

	await lock.lockWhen(() => blah());
	console.log('locked')
	lock.unlock();
	*/
	private mutex: Mutex
	private cond: Condition
	constructor() {
		this.mutex = new Mutex()
		this.cond = new Condition()
	}
	async lock(): Promise<void> {
		return this.mutex.lock()
	}
	tryLock(): boolean {
		return this.mutex.tryLock()
	}
	unlock(): void {
		this.mutex.unlock()
		this.cond.signal()
	}
	async withLock<T>(f: () => T | Promise<T>): Promise<T> {
		return this.mutex.withLock(f)
	}
	async waitUntil(cond: () => boolean): Promise<void> {
		while (!cond()) {
			await this.cond.wait(this.mutex)
		}
	}
	async lockWhen(cond: () => boolean): Promise<void> {
		await this.lock()
		while (!cond()) {
			await this.cond.wait(this.mutex)
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
		if (capacity <= 0) {
			throw new Error("the capacity must be greater than 0")
		}
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
		return this.readerLock.withLock(() => {
			this.reader -= 1
			if (this.reader === 0) {
				this.writeLock.unlock()
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
		mutex.unlock()
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
	console.log(once.isCompleted());
	*/
	private completed: boolean
	constructor() {
		this.completed = false
	}
	do(fn: () => unknown) {
		if (this.completed) return
		this.completed = true
		fn()
	}
	isCompleted(): boolean {
		return this.completed
	}
}

export class Mailbox<T> {
	private readers: Deferred<Option<T>>[]
	private writers: [Deferred<boolean>, T][]
	private closed: boolean
	private capacity: number
	private buffer: T[]
	constructor(capacity: number = 0) {
		if (!(Number.isSafeInteger(capacity) && capacity >= 0)) {
			throw new Error("the capacity must be a number not lesser than 0")
		}
		this.capacity = capacity
		this.buffer = []
		this.readers = []
		this.writers = []
		this.closed = false
	}
	close() {
		this.closed = true
		this.readers.forEach((r) => r.resolve(none))
		this.readers = []
	}
	isClosed(): boolean {
		return this.closed
	}
	isDrained(): boolean {
		if (!this.closed) return false
		return this.buffer.length === 0 && this.writers.length === 0
	}
	// Some(T) means a message is received from a writer
	// None means the mailbox is closed
	async read(): Promise<Option<T>> {
		const r = this.tryRead()
		if (r.isSome()) return r
		if (this.closed) return none
		const defer = new Deferred<Option<T>>()
		this.readers.push(defer)
		return defer.promise
	}
	tryRead(): Option<T> {
		if (this.buffer.length > 0) {
			const data = this.buffer.shift()!
			if (this.writers.length > 0) {
				const [w, data] = this.writers.shift()!
				w.resolve(true)
				this.buffer.push(data)
			}
			return some(data)
		}
		if (this.writers.length > 0) {
			const [w, data] = this.writers.shift()!
			w.resolve(true)
			return some(data)
		}
		// if (this.closed) return None
		return none
	}
	// true means the message is sent to a reader or buffer
	// false means the mailbox is closed and the data is discarded
	async write(data: T): Promise<boolean> {
		const r = this.tryWrite(data)
		if (r) return r
		if (this.closed) return false
		const w = new Deferred<boolean>()
		this.writers.push([w, data])
		return w.promise
	}
	tryWrite(data: T): boolean {
		if (this.closed) return false
		if (this.readers.length > 0) {
			const r = this.readers.shift()!
			r.resolve(some(data))
			return true
		}
		if (this.buffer.length < this.capacity) {
			this.buffer.push(data)
			return true
		}
		return false
	}
}
