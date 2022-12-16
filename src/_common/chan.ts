import { assert } from "./assert.js"
import { Deferred } from "./deferred.js"
import { Deque } from "./deque.js"
import { LinkedMap } from "./linked-map.js"
import { Option, Some, None } from "./option.js"

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
		this.sync()
	}
	private sendersRemove(sender: Sender<T>) {
		this.senders.remove(sender.id)
		this.sync()
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
			this.sendersAdd(sender)
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
		this.sync()
	}
	private receiversRemove(receiver: Receiver<T>) {
		this.receivers.remove(receiver.id)
		this.sync()
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
			this.receiversAdd(receiver)
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
	private state: "idle" | "running"
	private selections: Deque<Selection<unknown>>
	constructor() {
		this.state = "idle"
		this.selections = new Deque()
	}
	clone(): Select {
		const selections = this.selections.map((s) => ({ ...s, id: genId() }))
		const newSelection = new Select()
		newSelection.selections.pushBackArray(selections)
		return newSelection
	}
	send<T>(
		chan: Channel<T>,
		data: T,
		callback: (sent: boolean, id?: number) => unknown,
	): number {
		assert(
			!this.selections.some((sel) => sel.chan === chan),
			"[Select] duplicated channel",
		)

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
		this.selections.pushBack(selection)
		return id
	}
	receive<T>(
		chan: Channel<T>,
		callback: (data: Option<T>, id?: number) => unknown,
	): number {
		assert(
			!this.selections.some((sel) => sel.chan === chan),
			"[Select] duplicated channel",
		)

		const id = genId()
		const selection: Selection<T> = {
			id,
			op: "receive",
			chan,
			receiver: null,
			callback,
		}
		// @ts-expect-error
		this.selections.pushBack(selection)
		return id
	}
	async select(init?: { signal?: AbortSignal }): Promise<number | null> {
		this.beforeSelect()

		if (this.selections.length === 0) return null

		const signal = this.getAbortSignal(init)
		if (signal.isRejected) return null

		this.state = "running"
		const selected = this.fastSelect() ?? (await this.slowSelect(signal))
		this.state = "idle"
		return selected
	}
	trySelect(): number | null {
		this.beforeSelect()
		if (this.selections.length === 0) return null
		return this.fastSelect()
	}
	private getAbortSignal(init?: { signal?: AbortSignal }): Deferred<never> {
		const fakeSignal = new Deferred<never>()
		const signal = init?.signal
		if (signal) {
			if (signal.aborted) {
				fakeSignal.reject()
			} else {
				signal.addEventListener("abort", () => {
					fakeSignal.reject()
				})
			}
		}
		return fakeSignal
	}
	private beforeSelect(): void {
		assert(this.state === "idle", "[Select] not a idle selector")

		// randomize
		this.selections = Deque.fromArray(
			this.selections.toArray().sort(() => Math.random() - 0.5),
		)
	}
	private fastSelect(): number | null {
		for (let i = 0, len = this.selections.length; i < len; i++) {
			const selection = this.selections.get(i)
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
	private async slowSelect(signal: Deferred<never>): Promise<number | null> {
		let selected: number | null = null
		while (this.state === "running") {
			const done = this.setup(signal)

			try {
				selected = await Promise.race([
					done.promise,
					signal.promise, // pending or rejected
				])
				// one channel is selected
				this.state = "idle" // stop loop
			} catch (_) {
				// aborted by signal, but the select is done
				// XXX: is it possible?
				if (done.isResolved) {
					selected = await done.promise
					this.state = "idle" // stop loop
				}
				// aborted by signal
				// XXX: typescript doesn't know that signal will be updated
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
				else if (signal.isRejected) {
					this.state = "idle" // stop loop
				}
				// aborted by select
				else {
					// continue next loop
				}
			}

			this.cleanup()
		}

		return selected
	}
	private setup(signal: Deferred<never>): Deferred<number> {
		const done = new Deferred<number>()

		// setup lock
		let locked = false
		const tryLock = () => {
			if (locked || signal.isRejected || done.isFulfilled) {
				locked = true
				return false
			} else {
				locked = true
				return true
			}
		}

		for (let i = 0, len = this.selections.length; i < len; i++) {
			const selection = this.selections.get(i)
			if (selection.op === "send") {
				const sender: Sender<unknown> = {
					id: selection.id,
					tryLock: tryLock,
					unlock: done.reject,
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
					tryLock: tryLock,
					unlock: done.reject,
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
		return done
	}
	private cleanup(): void {
		for (let i = 0, len = this.selections.length; i < len; i++) {
			const selection = this.selections.get(i)
			if (selection.op === "send" && selection.sender) {
				// @ts-expect-error
				selection.chan.sendersRemove(selection.sender)
			} else if (selection.op == "receive" && selection.receiver) {
				// @ts-expect-error
				selection.chan.receiversRemove(selection.receiver)
			}
		}
	}
}
