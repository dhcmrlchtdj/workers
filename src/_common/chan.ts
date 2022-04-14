import { Deferred, Option, Some, None } from "./sync"

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
    id?: number
    defer: Deferred<boolean>
    data: T
    tryLock(): boolean
    abort(): void
    complete(): void
}

type Receiver<T> = {
    id?: number
    defer: Deferred<Option<T>>
    tryLock(): boolean
    abort(): void
    complete(): void
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
                    receiver.complete()
                    sender.defer.resolve(true)
                    sender.complete()
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
                            receiver.complete()
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
    send(data: T): Promise<boolean> {
        const r = this[fastSend](data)
        if (r.isSome) {
            return Promise.resolve(r.unwrap())
        } else {
            const sender: Sender<T> = {
                data,
                defer: new Deferred<boolean>(),
                tryLock: alwaysTrue,
                abort: noop,
                complete: noop,
            }
            this[sendersAdd](sender)
            return sender.defer.promise
        }
    }
    trySend(data: T): boolean {
        const r = this[fastSend](data)
        if (r.isSome) {
            return r.unwrap()
        } else {
            return false
        }
    }
    [fastSend](data: T): Option<boolean> {
        if (this.closed) {
            return Some(false)
        } else {
            if (this.senders.length > 0) {
                return None
            } else if (this.receivers.length > 0) {
                const receiver = this.receivers[0]!
                if (receiver.tryLock()) {
                    this.receivers.shift()
                    receiver.defer.resolve(Some(data))
                    receiver.complete()
                    return Some(true)
                } else {
                    return None
                }
            } else {
                return None
            }
        }
    }
    receive(): Promise<Option<T>> {
        const r = this[fastReceive]()
        if (r.isSome) {
            return Promise.resolve(r.unwrap())
        } else {
            const receiver: Receiver<T> = {
                defer: new Deferred<Option<T>>(),
                tryLock: alwaysTrue,
                abort: noop,
                complete: noop,
            }
            this[receiversAdd](receiver)
            return receiver.defer.promise
        }
    }
    tryReceive(): Option<T> {
        const r = this[fastReceive]()
        if (r.isSome) {
            return r.unwrap()
        } else {
            return None
        }
    }
    [fastReceive](): Option<Option<T>> {
        if (this.receivers.length > 0) {
            return None
        } else if (this.senders.length > 0) {
            const sender = this.senders[0]!
            if (sender.tryLock()) {
                this.senders.shift()
                sender.defer.resolve(true)
                sender.complete()
                return Some(Some(sender.data))
            } else {
                return None
            }
        } else {
            if (this.closed) {
                return Some(None)
            } else {
                return None
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
    private locked: boolean
    private tryLock: () => boolean
    constructor() {
        this.state = "idle"
        this.selections = []
        this.locked = false
        this.tryLock = () => {
            if (this.locked) {
                return false
            } else {
                this.locked = true
                return true
            }
        }
    }
    send<T>(chan: Channel<T>, data: T, callback: (sent: boolean) => unknown) {
        if (this.selections.some((sel) => sel.chan === chan)) {
            throw new Error("[Select] duplicated channel")
        }
        // @ts-ignore
        this.selections.push({ id: genId(), op: "send", chan, data, callback })
        return this
    }
    receive<T>(chan: Channel<T>, callback: (data: Option<T>) => unknown) {
        if (this.selections.some((sel) => sel.chan === chan)) {
            throw new Error("[Select] duplicated channel")
        }
        // @ts-ignore
        this.selections.push({ id: genId(), op: "receive", chan, callback })
        return this
    }
    async select() {
        if (this.state !== "idle") {
            throw new Error("[Select] not a idle selector")
        }
        // randomize
        this.selections.sort(() => Math.random() - 0.5)
        this.state = "running"
        while (this.state !== "running") {
            this.locked = false

            // try to send/receive
            for (const selection of this.selections) {
                if (selection.op === "send") {
                    const r = selection.chan[fastSend](selection.data)
                    if (r.isSome) {
                        selection.callback(r.unwrap())
                        this.state = "idle"
                        return
                    }
                } else {
                    const r = selection.chan[fastReceive]()
                    if (r.isSome) {
                        selection.callback(r.unwrap())
                        this.state = "idle"
                        return
                    }
                }
            }

            // block all channels
            const done = new Deferred()
            let idx = 0
            while (idx < this.selections.length) {
                const selection = this.selections[idx]!
                idx++
                if (selection.op === "send") {
                    const sender: Sender<unknown> = {
                        id: selection.id,
                        data: selection.data,
                        defer: new Deferred(),
                        tryLock: this.tryLock,
                        abort: done.reject,
                        complete: done.resolve,
                    }
                    sender.defer.promise.then(selection.callback)
                    selection.chan[sendersAdd](sender)
                } else {
                    const receiver: Receiver<unknown> = {
                        id: selection.id,
                        defer: new Deferred(),
                        tryLock: this.tryLock,
                        abort: done.reject,
                        complete: done.resolve,
                    }
                    receiver.defer.promise.then(selection.callback)
                    selection.chan[receiversAdd](receiver)
                }
                if (done.isFulfilled) break
            }
            try {
                await done.promise
                this.state = "idle"
            } catch (_) {
                // aborted
            }

            // cleanup
            while (idx > 0) {
                idx--
                const selection = this.selections[idx]!
                if (selection.op === "send") {
                    selection.chan[sendersRemove](selection.id)
                } else {
                    selection.chan[receiversRemove](selection.id)
                }
            }
        }
    }
}
