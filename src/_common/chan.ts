import { Deferred } from "./deferred"
import { Deque } from "./deque"
import { Option, Some, None } from "./option"

let currentId = 0
const genId = () => currentId++
const alwaysTrue = () => true
function noop() {}

///

/*
Usage:
const chan = new Channel<number>();
chan.send(10);
chan.close();
const msg = chan.tryReceive(); // => Some(10)
const empty = chan.tryReceive(); // => None
*/

type Sender<T> = {
    id: number
    defer: Deferred<boolean>
    data: T
    tryLock(): boolean
    abort(): void
    complete(id: number): void
}

type Receiver<T> = {
    id: number
    defer: Deferred<Option<T>>
    tryLock(): boolean
    abort(): void
    complete(id: number): void
}

const sendersAdd = Symbol()
const sendersRemove = Symbol()
const receiversAdd = Symbol()
const receiversRemove = Symbol()
const fastSend = Symbol()
const fastReceive = Symbol()

export class Channel<T = unknown> {
    private senders: Deque<Sender<T>>
    private receivers: Deque<Receiver<T>>
    private closed: boolean
    constructor() {
        this.senders = new Deque()
        this.receivers = new Deque()
        this.closed = false
    }
    close() {
        // don't close a channel from the receiver side
        // don't close a channel if the channel has multiple concurrent senders
        // by Go101
        if (this.closed) return
        this.closed = true
        this.rendezvous()
    }
    isClosed(): boolean {
        return this.closed
    }
    private rendezvous() {
        while (!this.receivers.isEmpty() && !this.senders.isEmpty()) {
            const receiver = this.receivers.getFront()
            const sender = this.senders.getFront()
            if (receiver.tryLock()) {
                if (sender.tryLock()) {
                    this.receivers.popFront()
                    this.senders.popFront()
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
            if (!this.receivers.isEmpty() && this.senders.isEmpty()) {
                this.receivers = Deque.fromArray(
                    this.receivers.filter((receiver) => {
                        if (receiver.tryLock()) {
                            receiver.defer.resolve(None)
                            receiver.complete(receiver.id)
                            return false
                        } else {
                            return true
                        }
                    }),
                )
            }
        }
    }
    [sendersAdd](sender: Sender<T>) {
        this.senders.pushBack(sender)
        this.rendezvous()
    }
    [sendersRemove](id: number) {
        this.senders = Deque.fromArray(
            this.senders.filter((x) => x.id !== id),
        )
        this.rendezvous()
    }
    [receiversAdd](receiver: Receiver<T>) {
        this.receivers.pushBack(receiver)
        this.rendezvous()
    }
    [receiversRemove](id: number) {
        this.receivers = Deque.fromArray(
            this.receivers.filter((x) => x.id !== id),
        )
        this.rendezvous()
    }
    async send(data: T): Promise<boolean> {
        const r = this[fastSend](data)
        if (r !== null) {
            return r
        } else {
            const sender: Sender<T> = {
                id: genId(),
                data,
                defer: new Deferred<boolean>(),
                tryLock: alwaysTrue,
                abort: noop,
                complete: noop,
            }
            this[sendersAdd](sender)
            return await sender.defer.promise
        }
    }
    trySend(data: T): boolean {
        const r = this[fastSend](data)
        return r ?? false
    }
    [fastSend](data: T): boolean | null {
        if (this.closed) {
            return false
        } else {
            if (!this.senders.isEmpty()) {
                return null
            } else if (!this.receivers.isEmpty()) {
                const receiver = this.receivers.getFront()
                if (receiver.tryLock()) {
                    this.receivers.popFront()
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
    async receive(): Promise<Option<T>> {
        const r = this[fastReceive]()
        if (r !== null) {
            return r
        } else {
            const receiver: Receiver<T> = {
                id: genId(),
                defer: new Deferred<Option<T>>(),
                tryLock: alwaysTrue,
                abort: noop,
                complete: noop,
            }
            this[receiversAdd](receiver)
            return await receiver.defer.promise
        }
    }
    tryReceive(): Option<T> {
        const r = this[fastReceive]()
        return r ?? None
    }
    [fastReceive](): Option<T> | null {
        if (!this.receivers.isEmpty()) {
            return null
        } else if (!this.senders.isEmpty()) {
            const sender = this.senders.getFront()
            if (sender.tryLock()) {
                this.senders.popFront()
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

type Selection<T> =
    | {
          id: number
          op: "send"
          chan: Channel<T>
          data: T
          callback: (sent: boolean) => unknown
      }
    | {
          id: number
          op: "receive"
          chan: Channel<T>
          callback: (data: Option<T>) => unknown
      }

export class Select {
    private state: "idle" | "running"
    private selections: Deque<Selection<unknown>>
    constructor() {
        this.state = "idle"
        this.selections = new Deque()
    }
    send<T>(
        chan: Channel<T>,
        data: T,
        callback?: (sent: boolean) => unknown,
    ): number {
        if (this.selections.some((sel) => sel.chan === chan)) {
            throw new Error("[Select] duplicated channel")
        }
        const id = genId()
        const selection: Selection<T> = {
            id,
            op: "send",
            chan,
            data,
            callback: callback ?? noop,
        }
        // @ts-ignore
        this.selections.pushBack(selection)
        return id
    }
    receive<T>(
        chan: Channel<T>,
        callback?: (data: Option<T>) => unknown,
    ): number {
        if (this.selections.some((sel) => sel.chan === chan)) {
            throw new Error("[Select] duplicated channel")
        }
        const id = genId()
        const selection: Selection<T> = {
            id,
            op: "receive",
            chan,
            callback: callback ?? noop,
        }
        // @ts-ignore
        this.selections.pushBack(selection)
        return id
    }
    async select(init?: { signal?: AbortSignal }): Promise<number | null> {
        this.beforeSelect()

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
                        data: selection.data,
                        defer: new Deferred(),
                        tryLock: tryLock,
                        abort: done.reject,
                        complete: done.resolve,
                    }
                    sender.defer.promise.then(selection.callback)
                    selection.chan[sendersAdd](sender)
                } else {
                    const receiver: Receiver<unknown> = {
                        id: selection.id,
                        defer: new Deferred(),
                        tryLock: tryLock,
                        abort: done.reject,
                        complete: done.resolve,
                    }
                    receiver.defer.promise.then(selection.callback)
                    selection.chan[receiversAdd](receiver)
                }
                if (done.isFulfilled) break
            }
            try {
                selected = await Promise.race([
                    done.promise,
                    signal.defer.promise, // never resolve
                ])
                this.state = "idle" // stop loop
            } catch (_) {
                if (done.isResolved) {
                    // XXX: is it possible?
                    // aborted by signal, but the select is done
                    selected = await done.promise
                    this.state = "idle" // stop loop
                } else if (signal.aborted) {
                    // aborted by signal
                    this.state = "idle" // stop loop
                } else {
                    // aborted by select
                    // continue next loop
                }
            }

            this.cleanup(idx)
        }

        return selected
    }
    trySelect(): number | null {
        this.beforeSelect()
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
                const r = selection.chan[fastSend](selection.data)
                if (r !== null) {
                    selection.callback(r)
                    return selection.id
                }
            } else {
                const r = selection.chan[fastReceive]()
                if (r !== null) {
                    selection.callback(r)
                    return selection.id
                }
            }
        }
        return null
    }
    private cleanup(length: number): void {
        for (let i = 0; i < length; i++) {
            const selection = this.selections.get(i)
            if (selection.op === "send") {
                selection.chan[sendersRemove](selection.id)
            } else {
                selection.chan[receiversRemove](selection.id)
            }
        }
    }
}
