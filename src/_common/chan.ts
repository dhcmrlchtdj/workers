import { Deferred, Option, Some, None } from "./sync"

let currentId = 0
const genId = () => currentId++
const alwaysTrue = () => true
const alwaysFalse = () => false
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
    id?: number
    defer: Deferred<boolean>
    data: T
    tryLock(): boolean
    abort(): void
    complete(id?: number): void
}

type Receiver<T> = {
    id?: number
    defer: Deferred<Option<T>>
    tryLock(): boolean
    abort(): void
    complete(id?: number): void
}

const sendersAdd = Symbol()
const sendersRemove = Symbol()
const receiversAdd = Symbol()
const receiversRemove = Symbol()
const fastSend = Symbol()
const fastReceive = Symbol()

export class Channel<T = unknown> {
    private senders: Sender<T>[]
    private receivers: Receiver<T>[]
    private closed: boolean
    constructor() {
        this.senders = []
        this.receivers = []
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
        while (this.receivers.length > 0 && this.senders.length > 0) {
            const receiver = this.receivers[0]!
            const sender = this.senders[0]!
            if (receiver.tryLock()) {
                if (sender.tryLock()) {
                    this.receivers.shift()
                    this.senders.shift()
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
            if (this.receivers.length > 0 && this.senders.length === 0) {
                this.receivers = this.receivers
                    .map((receiver) => {
                        if (receiver.tryLock()) {
                            receiver.defer.resolve(None)
                            receiver.complete(receiver.id)
                            return null
                        } else {
                            return receiver
                        }
                    })
                    .filter(Boolean) as Receiver<T>[]
            }
        }
    }
    [sendersAdd](sender: Sender<T>) {
        this.senders.push(sender)
        this.rendezvous()
    }
    [sendersRemove](id: number) {
        this.senders = this.senders.filter((x) => x.id !== id)
        this.rendezvous()
    }
    [receiversAdd](receiver: Receiver<T>) {
        this.receivers.push(receiver)
        this.rendezvous()
    }
    [receiversRemove](id: number) {
        this.receivers = this.receivers.filter((x) => x.id !== id)
        this.rendezvous()
    }
    async send(data: T): Promise<boolean> {
        const r = this[fastSend](data)
        if (r !== null) {
            return r
        } else {
            const sender: Sender<T> = {
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
            if (this.senders.length > 0) {
                return null
            } else if (this.receivers.length > 0) {
                const receiver = this.receivers[0]!
                if (receiver.tryLock()) {
                    this.receivers.shift()
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
        if (this.receivers.length > 0) {
            return null
        } else if (this.senders.length > 0) {
            const sender = this.senders[0]!
            if (sender.tryLock()) {
                this.senders.shift()
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
    private selections: Selection<unknown>[]
    constructor() {
        this.state = "idle"
        this.selections = []
    }
    send<T>(
        chan: Channel<T>,
        data: T,
        callback: (sent: boolean) => unknown,
    ): number {
        if (this.selections.some((sel) => sel.chan === chan)) {
            throw new Error("[Select] duplicated channel")
        }
        const id = genId()
        this.selections.push({
            id,
            op: "send",
            // @ts-ignore
            chan,
            data,
            callback,
        })
        return id
    }
    receive<T>(
        chan: Channel<T>,
        callback: (data: Option<T>) => unknown,
    ): number {
        if (this.selections.some((sel) => sel.chan === chan)) {
            throw new Error("[Select] duplicated channel")
        }
        const id = genId()
        this.selections.push({
            id,
            op: "receive",
            // @ts-ignore
            chan,
            // @ts-ignore
            callback,
        })
        return id
    }
    async select(init?: { signal?: AbortSignal }): Promise<number | null> {
        this.beforeSelect()

        const signal = this.getAbortSignal(init)
        if (signal.aborted()) return null

        let selected: number | null = null

        // setup lock
        let locked = false
        const tryLock = () => {
            if (locked || signal.aborted()) {
                return false
            } else {
                locked = true
                return true
            }
        }

        this.state = "running"
        while (this.state !== "running") {
            if (signal.aborted()) break

            // try to send/receive
            selected = this.fastSelect()
            if (selected !== null) break

            // block all channels
            const done = new Deferred<number>()
            let idx = 0
            while (idx < this.selections.length) {
                const selection = this.selections[idx]!
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
                    signal.defer.promise,
                ])
                this.state = "idle" // stop loop
            } catch (_) {
                if (signal.aborted()) {
                    // aborted by signal
                    this.state = "idle" // stop loop
                } else {
                    // aborted by channel
                    locked = false
                }
            }

            this.cleanup(idx)
        }

        this.state = "idle"
        return selected
    }
    trySelect(): number | null {
        this.beforeSelect()
        return this.fastSelect()
    }
    private getAbortSignal(init?: { signal?: AbortSignal }) {
        const signal = {
            aborted: alwaysFalse,
            defer: new Deferred<never>(),
        }
        const realSignal = init?.signal
        if (realSignal) {
            signal.aborted = () => realSignal.aborted
            realSignal.addEventListener("abort", () => {
                signal.defer.reject()
            })
        }
        return signal
    }
    private beforeSelect() {
        if (this.state !== "idle") {
            throw new Error("[Select] not a idle selector")
        }
        // randomize
        this.selections.sort(() => Math.random() - 0.5)
    }
    private fastSelect(): number | null {
        for (const selection of this.selections) {
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
    private cleanup(length: number) {
        for (let i = 0; i < length; i++) {
            const selection = this.selections[i]!
            if (selection.op === "send") {
                selection.chan[sendersRemove](selection.id)
            } else {
                selection.chan[receiversRemove](selection.id)
            }
        }
    }
}
