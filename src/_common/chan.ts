import { Deferred } from "./deferred.js"
import { Deque } from "./deque.js"
import { Option, Some, None } from "./option.js"
import {OrderedMap} from "./ordered-map.js"

let currentId = 0
const genId = () => currentId++
const alwaysTrue = () => true
const noop = () => true

///

type Sender<T> = {
	id: number
	status: "pending" | "done" // this is set/updated by Selection
	tryLock(): boolean
	abort(): void
	complete(id: number): void
	defer: Deferred<boolean>
	data: T
}
type Receiver<T> = {
	id: number
	status: "pending" | "done" // this is set/updated by Selection
	tryLock(): boolean
	abort(): void
	complete(id: number): void
	defer: Deferred<Option<T>>
}

export class Channel<T = unknown> {
	private senders: OrderedMap<number, Sender<T>>
	private receivers: OrderedMap<number, Receiver<T>>
	private closed: boolean
	constructor() {
		this.senders = new OrderedMap()
		this.receivers = new OrderedMap()
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

	// cleanup done selection
	private _taskDone(this: void, _: unknown, val: Sender<T> | Receiver<T>) {
		return val.status === "done"
	}
	private cleanup() {
		this.senders.removeIf(this._taskDone)
		this.receivers.removeIf(this._taskDone)
	}

	private sync() {
		this.cleanup()
		while (this.receivers.size() > 0 && this.senders.size() > 0) {
			const receiver = this.receivers.getFirst().unwrap()
			const sender = this.senders.getFirst().unwrap()
			if (receiver.tryLock()) {
				if (sender.tryLock()) {
					this.receivers.removeFirst()
					this.senders.removeFirst()
					receiver.defer.resolve(Some(sender.data))
					receiver.complete(receiver.id)
					sender.defer.resolve(true)
					sender.complete(sender.id)
				} else {
					receiver.abort()
					break
				}
			} else {
				break
			}
		}
		if (this.closed) {
			if (this.receivers.size() > 0 && this.senders.size() === 0) {
				this.receivers.removeIf((_, receiver) => {
					if (receiver.tryLock()) {
						receiver.defer.resolve(None)
						receiver.complete(receiver.id)
						return true
					} else {
						return false
					}
				})
			}
		}
	}

	private sendersAdd(sender: Sender<T>) {
		this.senders.addLast(sender.id, sender)
		this.sync()
	}
	async send(data: T): Promise<boolean> {
		const r = this.fastSend(data)
		if (r !== null) {
			return r
		} else {
			const sender: Sender<T> = {
				id: genId(),
				status: "pending",
				tryLock: alwaysTrue,
				abort: noop,
				complete: noop,
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
		this.cleanup()
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
					receiver.complete(receiver.id)
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
	async receive(): Promise<Option<T>> {
		const r = this.fastReceive()
		if (r !== null) {
			return r
		} else {
			const receiver: Receiver<T> = {
				id: genId(),
				status: "pending",
				tryLock: alwaysTrue,
				abort: noop,
				complete: noop,
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
		this.cleanup()
		if (this.receivers.size() > 0) {
			return null
		} else if (this.senders.size() > 0) {
			const sender = this.senders.getFirst().unwrap()
			if (sender.tryLock()) {
				this.senders.removeFirst()
				sender.defer.resolve(true)
				sender.complete(sender.id)
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
		if (this.selections.some((sel) => sel.chan === chan)) {
			throw new Error("[Select] duplicated channel")
		}
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
		if (this.selections.some((sel) => sel.chan === chan)) {
			throw new Error("[Select] duplicated channel")
		}
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
		if (signal.aborted) return null

		// setup lock
		let locked = false
		const tryLock = () => {
			if (locked || signal.aborted) {
				return false
			} else {
				locked = true
				return true
			}
		}

		let selected: number | null = null

		this.state = "running"
		while (this.state === "running") {
			locked = false

			// fast send/receive
			selected = this.fastSelect()
			if (selected !== null) {
				this.state = "idle"
				break
			}

			// block all channels
			const done = new Deferred<number>()
			let idx = 0
			const len = this.selections.length
			while (idx < len) {
				const selection = this.selections.get(idx)
				idx++
				if (selection.op === "send") {
					const sender: Sender<unknown> = {
						id: selection.id,
						status: "pending",
						tryLock: tryLock,
						abort: done.reject,
						complete: done.resolve,
						data: selection.data,
						defer: new Deferred(),
					}
					selection.sender = sender
					// eslint-disable-next-line @typescript-eslint/no-floating-promises
					sender.defer.promise.then((r) =>
						selection.callback(r, selection.id),
					)
					// @ts-expect-error
					selection.chan.sendersAdd(sender)
				} else {
					const receiver: Receiver<unknown> = {
						id: selection.id,
						status: "pending",
						tryLock: tryLock,
						abort: done.reject,
						complete: done.resolve,
						defer: new Deferred(),
					}
					selection.receiver = receiver
					// eslint-disable-next-line @typescript-eslint/no-floating-promises
					receiver.defer.promise.then((r) =>
						selection.callback(r, selection.id),
					)
					// @ts-expect-error
					selection.chan.receiversAdd(receiver)
				}
				if (done.isFulfilled) break
			}
			try {
				selected = await Promise.race([
					done.promise,
					signal.defer.promise, // pending or rejected
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
				else if (signal.aborted) {
					this.state = "idle" // stop loop
				}
				// aborted by select
				else {
					// continue next loop
				}
			}

			this.cleanup(idx)
		}

		return selected
	}
	trySelect(): number | null {
		this.beforeSelect()
		if (this.selections.length === 0) return null
		return this.fastSelect()
	}
	private getAbortSignal(init?: { signal?: AbortSignal }): {
		aborted: boolean
		defer: Deferred<never>
	} {
		const fakeSignal = {
			aborted: false,
			defer: new Deferred<never>(),
		}
		const signal = init?.signal
		if (signal) {
			fakeSignal.aborted = signal.aborted
			signal.addEventListener("abort", () => {
				fakeSignal.aborted = true
				fakeSignal.defer.reject()
			})
		}
		return fakeSignal
	}
	private beforeSelect(): void {
		if (this.state !== "idle") {
			throw new Error("[Select] not a idle selector")
		}
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
	private cleanup(length: number): void {
		for (let i = 0; i < length; i++) {
			const selection = this.selections.get(i)
			if (selection.op === "send" && selection.sender) {
				selection.sender.status = "done"
			} else if (selection.op == "receive" && selection.receiver) {
				selection.receiver.status = "done"
			}
		}
	}
}
