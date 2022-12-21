import { assert } from "./assert.js"
import { Deferred } from "./deferred.js"
import { LinkedMap } from "./linked-map.js"
import { Option, Some, None } from "./option.js"
import { sleep } from "./sync.js"

let currentId = 0
const genId = () => currentId++
const alwaysTrue = () => true
const noop = () => {}

///

type Sender<T> = {
	id: number
	tryLock(): boolean
	unlock(): void
	defer: Deferred<boolean>
	data: T
}
type Receiver<T> = {
	id: number
	tryLock(): boolean
	unlock(): void
	defer: Deferred<Option<T>>
}

export class Channel<T = unknown> {
	private senders: LinkedMap<number, Sender<T>>
	private receivers: LinkedMap<number, Receiver<T>>
	private closed: boolean
	constructor() {
		this.senders = new LinkedMap()
		this.receivers = new LinkedMap()
		this.closed = false
	}

	close() {
		// don't close a channel from the receiver side
		// don't close a channel if the channel has multiple concurrent senders
		// by Go101
		if (this.closed) return
		this.closed = true
		this.sync()
	}
	isClosed(): boolean {
		return this.closed
	}

	private sync() {
		while (this.receivers.size() > 0 && this.senders.size() > 0) {
			const receiver = this.receivers.getFirst().unwrap()
			const sender = this.senders.getFirst().unwrap()
			if (receiver.tryLock()) {
				if (sender.tryLock()) {
					this.receivers.removeFirst()
					this.senders.removeFirst()
					receiver.defer.resolve(Some(sender.data))
					sender.defer.resolve(true)
				} else {
					receiver.unlock()
					break
				}
			} else {
				break
			}
		}
		if (this.closed) {
			if (this.receivers.size() > 0 && this.senders.size() === 0) {
				for (const rid of this.receivers.keys()) {
					const receiver = this.receivers.get(rid).unwrap()
					if (receiver.tryLock()) {
						receiver.defer.resolve(None)
						this.receivers.remove(rid)
					}
				}
			}
		}
	}

	private sendersAdd(sender: Sender<T>) {
		this.senders.addLast(sender.id, sender)
	}
	private sendersRemove(sender: Sender<T>) {
		this.senders.remove(sender.id)
	}
	async send(data: T): Promise<boolean> {
		const r = this.fastSend(data)
		if (r !== null) {
			return r
		} else {
			const sender: Sender<T> = {
				id: genId(),
				tryLock: alwaysTrue,
				unlock: noop,
				data,
				defer: new Deferred<boolean>(),
			}
			this.senders.addLast(sender.id, sender)
			return await sender.defer.promise
		}
	}
	trySend(data: T): boolean {
		const r = this.fastSend(data)
		return r ?? false
	}
	private fastSend(data: T): boolean | null {
		if (this.closed) {
			return false
		} else {
			if (this.senders.size() > 0) {
				return null
			} else if (this.receivers.size() > 0) {
				const receiver = this.receivers.getFirst().unwrap()
				if (receiver.tryLock()) {
					this.receivers.removeFirst()
					receiver.defer.resolve(Some(data))
					return true
				} else {
					return null
				}
			} else {
				return null
			}
		}
	}

	private receiversAdd(receiver: Receiver<T>) {
		this.receivers.addLast(receiver.id, receiver)
	}
	private receiversRemove(receiver: Receiver<T>) {
		this.receivers.remove(receiver.id)
	}
	async receive(): Promise<Option<T>> {
		const r = this.fastReceive()
		if (r !== null) {
			return r
		} else {
			const receiver: Receiver<T> = {
				id: genId(),
				tryLock: alwaysTrue,
				unlock: noop,
				defer: new Deferred<Option<T>>(),
			}
			this.receivers.addLast(receiver.id, receiver)
			return await receiver.defer.promise
		}
	}
	tryReceive(): Option<T> {
		const r = this.fastReceive()
		return r ?? None
	}
	private fastReceive(): Option<T> | null {
		if (this.receivers.size() > 0) {
			return null
		} else if (this.senders.size() > 0) {
			const sender = this.senders.getFirst().unwrap()
			if (sender.tryLock()) {
				this.senders.removeFirst()
				sender.defer.resolve(true)
				return Some(sender.data)
			} else {
				return null
			}
		} else {
			if (this.closed) {
				return None
			} else {
				return null
			}
		}
	}
}

///

type Selection<T> =
	| {
			id: number
			op: "send"
			chan: Channel<T>
			sender: Sender<T> | null
			data: T
			callback: (sent: boolean, id?: number) => unknown
	  }
	| {
			id: number
			op: "receive"
			chan: Channel<T>
			receiver: Receiver<T> | null
			callback: (data: Option<T>, id?: number) => unknown
	  }

export class Select {
	private running: boolean
	private backgroundRunning: boolean
	private wakeupSet: Set<number>
	private selections: Selection<unknown>[]
	constructor() {
		this.running = false
		this.backgroundRunning = false
		this.wakeupSet = new Set()
		this.selections = []
	}
	send<T>(
		chan: Channel<T>,
		data: T,
		callback: (sent: boolean, id?: number) => unknown,
	): number {
		assert(
			this.selections.every((sel) => sel.chan !== chan),
			"[Select] duplicated channel",
		)
		assert(!this.running, "[Select] not a idle selector")

		const id = genId()
		const selection: Selection<T> = {
			id,
			op: "send",
			chan,
			sender: null,
			data,
			callback,
		}
		// @ts-expect-error
		this.selections.push(selection)
		return id
	}
	receive<T>(
		chan: Channel<T>,
		callback: (data: Option<T>, id?: number) => unknown,
	): number {
		assert(
			this.selections.every((sel) => sel.chan !== chan),
			"[Select] duplicated channel",
		)
		assert(!this.running, "[Select] not a idle selector")

		const id = genId()
		const selection: Selection<T> = {
			id,
			op: "receive",
			chan,
			receiver: null,
			callback,
		}
		// @ts-expect-error
		this.selections.push(selection)
		return id
	}
	async select(init?: { signal?: AbortSignal }): Promise<number | null> {
		this.beforeSelect()

		if (this.selections.length === 0) return null

		const done = new Deferred<number | null>()

		this.setupAbortSignal(done, init?.signal)
		if (done.isFulfilled) return done.promise

		this.running = true
		const selected = this.fastSelect() ?? (await this.slowSelect(done))
		this.running = false
		return selected
	}
	trySelect(): number | null {
		this.beforeSelect()
		if (this.selections.length === 0) return null
		return this.fastSelect()
	}
	private setupAbortSignal(
		done: Deferred<number | null>,
		signal: AbortSignal | undefined,
	) {
		if (signal) {
			if (signal.aborted) {
				done.resolve(null)
			} else {
				const cb = () => done.resolve(null)
				signal.addEventListener("abort", cb)
				done.promise.finally(() => {
					signal.removeEventListener("abort", cb)
				})
			}
		}
	}
	private beforeSelect(): void {
		assert(!this.running, "[Select] not a idle selector")

		// randomize
		this.selections.sort(() => Math.random() - 0.5)
	}
	private fastSelect(): number | null {
		for (const selection of this.selections) {
			if (selection.op === "send") {
				// @ts-expect-error
				const r = selection.chan.fastSend(selection.data)
				if (r !== null) {
					selection.callback(r, selection.id)
					return selection.id
				}
			} else {
				// @ts-expect-error
				const r = selection.chan.fastReceive()
				if (r !== null) {
					selection.callback(r, selection.id)
					return selection.id
				}
			}
		}
		return null
	}
	private async slowSelect(
		done: Deferred<number | null>,
	): Promise<number | null> {
		this.setup(done)
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		this.wakeup(done)
		await done.promise
		this.cleanup()

		return done.promise
	}
	private setup(done: Deferred<number | null>): void {
		// setup lock
		let locked = false
		const tryLock = (id: number) => () => {
			if (done.isFulfilled) {
				return false
			}

			if (locked) {
				this.wakeupSet.add(id)
				return false
			} else {
				locked = true
				return true
			}
		}
		const unlock = () => {
			locked = false
			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			this.wakeup(done)
		}

		// setup channel
		for (let i = 0, len = this.selections.length; i < len; i++) {
			const selection = this.selections[i]!
			if (selection.op === "send") {
				const sender: Sender<unknown> = {
					id: selection.id,
					tryLock: tryLock(i),
					unlock,
					data: selection.data,
					defer: new Deferred(),
				}
				selection.sender = sender
				// eslint-disable-next-line @typescript-eslint/no-floating-promises
				sender.defer.promise.then((r) => {
					done.resolve(selection.id)
					selection.callback(r, selection.id)
				})
				// @ts-expect-error
				selection.chan.sendersAdd(sender)
			} else {
				const receiver: Receiver<unknown> = {
					id: selection.id,
					tryLock: tryLock(i),
					unlock,
					defer: new Deferred(),
				}
				selection.receiver = receiver
				// eslint-disable-next-line @typescript-eslint/no-floating-promises
				receiver.defer.promise.then((r) => {
					done.resolve(selection.id)
					selection.callback(r, selection.id)
				})
				// @ts-expect-error
				selection.chan.receiversAdd(receiver)
			}
			if (done.isResolved) break
		}

		// setup wakeupSet
		for (let i = 0, len = this.selections.length; i < len; i++) {
			this.wakeupSet.add(i)
		}
	}
	private async wakeup(done: Deferred<number | null>): Promise<void> {
		if (this.backgroundRunning) return
		this.backgroundRunning = true
		try {
			while (this.wakeupSet.size > 0 && !done.isFulfilled) {
				const tasks = [...this.wakeupSet.values()] // copy tasks
				this.wakeupSet.clear() // reset tasks
				for (let i = 0, len = tasks.length; i < len; i++) {
					const selection = this.selections[i]!
					// @ts-expect-error
					selection.chan.sync()
					// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
					if (done.isFulfilled) return
				}
				await sleep(0)
			}
		} finally {
			this.backgroundRunning = false
		}
	}
	private cleanup(): void {
		for (const selection of this.selections) {
			if (selection.op === "send" && selection.sender) {
				// @ts-expect-error
				selection.chan.sendersRemove(selection.sender)
				selection.sender = null
			} else if (selection.op == "receive" && selection.receiver) {
				// @ts-expect-error
				selection.chan.receiversRemove(selection.receiver)
				selection.receiver = null
			}
			// @ts-expect-error
			selection.chan.sync()
		}

		this.wakeupSet.clear()

		this.backgroundRunning = false
	}
}
