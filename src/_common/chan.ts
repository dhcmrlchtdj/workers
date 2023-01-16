import { assert } from "./assert.js"
import { abortedBySignal, Deferred } from "./deferred.js"
import { LinkedMap } from "./linked-map.js"
import { Option, some, none } from "./option.js"

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
					receiver.defer.resolve(some(sender.data))
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
						receiver.defer.resolve(none)
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
					receiver.defer.resolve(some(data))
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
		return r ?? none
	}
	private fastReceive(): Option<T> | null {
		if (this.receivers.size() > 0) {
			return null
		} else if (this.senders.size() > 0) {
			const sender = this.senders.getFirst().unwrap()
			if (sender.tryLock()) {
				this.senders.removeFirst()
				sender.defer.resolve(true)
				return some(sender.data)
			} else {
				return null
			}
		} else {
			if (this.closed) {
				return none
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
	private selections: Selection<unknown>[]
	constructor() {
		this.running = false
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
	async select(opt?: { signal?: AbortSignal }): Promise<number | null> {
		this.beforeSelect()

		if (this.selections.length === 0) return null

		const done = new Deferred<number>()

		abortedBySignal(done, opt?.signal)
		if (done.isFulfilled) return null

		const fast = this.fastSelect()
		if (fast !== null) return fast

		this.running = true
		const slow = await this.slowSelect(done)
		this.running = false
		return slow
	}
	trySelect(): number | null {
		this.beforeSelect()
		if (this.selections.length === 0) return null
		return this.fastSelect()
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
	private async slowSelect(done: Deferred<number>): Promise<number | null> {
		this.setup(done)
		try {
			return await done.promise
		} catch (e) {
			return null
		} finally {
			this.cleanup()
		}
	}
	private setup(done: Deferred<number>): void {
		// setup waiting list
		const waitings = new Channel<number>()
		done.promise.finally(() => waitings.close()).catch(noop) // prevent `unhandledRejection`
		for (let i = 0, len = this.selections.length; i < len; i++) {
			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			waitings.send(i)
		}

		// setup lock
		let locked = false
		const tryLock = (id: number) => () => {
			if (done.isFulfilled) {
				return false
			}

			if (locked) {
				// eslint-disable-next-line @typescript-eslint/no-floating-promises
				waitings.send(id)
				return false
			} else {
				locked = true
				return true
			}
		}
		const unlock = () => {
			locked = false
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
			if (done.isFulfilled) break
		}

		// start background job
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		this.wakeup(waitings)
	}
	private async wakeup(waitings: Channel<number>): Promise<void> {
		while (!waitings.isClosed()) {
			const r = await waitings.receive()
			if (r.isNone()) return
			const idx = r.unwrap()
			const selection = this.selections[idx]
			// @ts-expect-error
			selection?.chan.sync()
		}
	}
	private cleanup(): void {
		for (const selection of this.selections) {
			if (selection.op === "send" && selection.sender) {
				// @ts-expect-error
				selection.chan.sendersRemove(selection.sender)
				selection.sender = null
				// @ts-expect-error
				selection.chan.sync()
			} else if (selection.op == "receive" && selection.receiver) {
				// @ts-expect-error
				selection.chan.receiversRemove(selection.receiver)
				selection.receiver = null
				// @ts-expect-error
				selection.chan.sync()
			}
		}
	}
}
