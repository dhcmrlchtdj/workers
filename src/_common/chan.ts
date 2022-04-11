import { Deferred, Option, Some, None, sleep } from "./sync"

class ID {
    static count = 0
    static gen() {
        ID.count++
        return ID.count
    }
}

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
    unlock(): void
    complete(): void
}

type Receiver<T> = {
    id?: number
    defer: Deferred<Option<T>>
    tryLock(): boolean
    unlock(): void
    complete(): void
}

export class Channel<T = unknown> {
    private senders: Sender<T>[]
    private receivers: Receiver<T>[]
    private closed: boolean
    private syncing: boolean
    constructor() {
        this.senders = []
        this.receivers = []
        this.closed = false
        this.syncing = false
    }
    async close() {
        // don't close a channel from the receiver side
        // don't close a channel if the channel has multiple concurrent senders
        // by Go101
        if (this.closed) return
        this.closed = true
        while (this.receivers.length > 0) {
            if (this.senders.length === 0) {
                this.receivers = this.receivers
                    .map((receiver) => {
                        if (receiver.tryLock()) {
                            receiver.defer.resolve(None)
                            return null
                        } else {
                            return receiver
                        }
                    })
                    .filter(Boolean) as Receiver<T>[]
                await sleep(1)
            } else {
                await this.sync()
            }
        }
    }
    isClosed(): boolean {
        return this.closed
    }
    private async sync() {
        if (this.syncing) return
        this.syncing = true
        while (this.receivers.length > 0 && this.senders.length > 0) {
            const receiver = this.receivers[0]!
            const sender = this.senders[0]!
            if (receiver.tryLock()) {
                if (sender.tryLock()) {
                    this.receivers.shift()
                    this.senders.shift()
                    receiver.defer.resolve(Some(sender.data))
                    receiver.complete()
                    receiver.unlock()
                    sender.defer.resolve(true)
                    sender.complete()
                    sender.unlock()
                } else {
                    receiver.unlock()
                    await sleep(1)
                }
            } else {
                await sleep(1)
            }
        }
        this.syncing = false
    }
    private pushToQueue(queue: "senders", waiter: Sender<T>): void
    private pushToQueue(queue: "receivers", waiter: Receiver<T>): void
    private pushToQueue(
        queue: "senders" | "receivers",
        waiter: Sender<T> | Receiver<T>,
    ) {
        // @ts-ignore
        this[queue].push(waiter)
        this.sync()
    }
    async send(data: T): Promise<boolean> {
        const r = this.trySend(data)
        if (r.isSome) {
            return r.getExn()
        } else {
            const sender: Sender<T> = {
                data,
                defer: new Deferred<boolean>(),
                tryLock() {
                    return true
                },
                unlock() {},
                complete() {},
            }
            this.pushToQueue("senders", sender)
            return sender.defer.promise
        }
    }
    trySend(data: T): Option<boolean> {
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
                    receiver.unlock()
                    return Some(true)
                } else {
                    return None
                }
            } else {
                return None
            }
        }
    }
    async receive(): Promise<Option<T>> {
        const r = this.tryReceive()
        if (r.isSome) {
            return r.getExn()
        } else {
            const receiver: Receiver<T> = {
                defer: new Deferred<Option<T>>(),
                tryLock() {
                    return true
                },
                unlock() {},
                complete() {},
            }
            this.pushToQueue("receivers", receiver)
            return receiver.defer.promise
        }
    }
    tryReceive(): Option<Option<T>> {
        if (this.receivers.length > 0) {
            return None
        } else if (this.senders.length > 0) {
            const sender = this.senders[0]!
            if (sender.tryLock()) {
                this.senders.shift()
                sender.defer.resolve(true)
                sender.unlock()
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
    private selections: Selection<any>[]
    private locked: boolean
    private tryLock: () => boolean
    private unlock: () => void
    constructor() {
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
        this.unlock = () => {
            this.locked = false
        }
    }
    send<T>(chan: Channel<T>, data: T, callback: (sent: boolean) => unknown) {
        if (this.selections.some((sel) => sel.chan === chan)) {
            throw new Error("duplicated channel")
        }
        this.selections.push({ id: ID.gen(), op: "send", chan, data, callback })
        return this
    }
    receive<T>(chan: Channel<T>, callback: (data: Option<T>) => unknown) {
        if (this.selections.some((sel) => sel.chan === chan)) {
            throw new Error("duplicated channel")
        }
        this.selections.push({ id: ID.gen(), op: "receive", chan, callback })
        return this
    }
    async select() {
        // randomize
        this.selections.sort(() => Math.random() - 0.5)
        // try to send/receive
        for (let selection of this.selections) {
            if (selection.op === "send") {
                const r = selection.chan.trySend(selection.data)
                if (r.isSome) {
                    selection.callback(r.getExn())
                    return
                }
            } else {
                const r = selection.chan.tryReceive()
                if (r.isSome) {
                    selection.callback(r.getExn())
                    return
                }
            }
        }
        // block all channels
        const completed = new Deferred()
        for (let selection of this.selections) {
            if (selection.op === "send") {
                const sender: Sender<unknown> = {
                    id: selection.id,
                    data: selection.data,
                    defer: new Deferred(),
                    tryLock: this.tryLock,
                    unlock: this.unlock,
                    complete: completed.resolve,
                }
                sender.defer.promise.then(selection.callback)
                // @ts-ignore
                selection.chan.pushToQueue("senders", sender)
            } else {
                const receiver: Receiver<unknown> = {
                    id: selection.id,
                    defer: new Deferred(),
                    tryLock: this.tryLock,
                    unlock: this.unlock,
                    complete: completed.resolve,
                }
                receiver.defer.promise.then(selection.callback)
                // @ts-ignore
                selection.chan.pushToQueue("receivers", receiver)
            }
        }
        await completed.promise
        // cleanup
        for (const selection of this.selections) {
            if (selection.op === "send") {
                // @ts-ignore
                selection.chan.senders = selection.chan.senders.filter(
                    (waiter) => waiter.id !== selection.id,
                )
            } else {
                // @ts-ignore
                selection.chan.receivers = selection.chan.receivers.filter(
                    (waiter) => waiter.id !== selection.id,
                )
            }
        }
    }
}
