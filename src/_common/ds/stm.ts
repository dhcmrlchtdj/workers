// based on https://github.com/tiancaiamao/stm
// Apache-2.0 license

class Transaction {
	rv: number
	readSet: Var<unknown>[]
	writeSet: Map<Var<unknown>, unknown>

	retry: boolean
	locked: Var<unknown>[]

	constructor() {
		this.rv = 0
		this.readSet = []
		this.writeSet = new Map()
		this.retry = false
		this.locked = []
	}
}

class VersionConflictError extends Error {}

class VersionLock {
	private version: number
	constructor() {
		this.version = 0
	}
	load(): number {
		return this.version
	}
	increment(): number {
		this.version++
		return this.version
	}
}
const globalVersionLock = new VersionLock()

class VersionedWriteLock {
	locked: boolean
	version: number
	constructor() {
		this.locked = false
		this.version = 0
	}
	tryAcquire(): boolean {
		if (this.locked) {
			return false
		} else {
			this.locked = true
			return true
		}
	}
	commit(version: number) {
		if (!this.locked) {
			throw new Error("commit() something is wrong")
		}
		this.version = version
		this.locked = false
	}
	release() {
		if (!this.locked) {
			throw new Error("release() something is wrong")
		}
		this.locked = false
	}
}

const VarLock = Symbol("VarLock")
const VarValue = Symbol("VarValue")
export class Var<T> {
	[VarValue]: T;
	[VarLock]: VersionedWriteLock
	constructor(value: T) {
		this[VarValue] = value
		this[VarLock] = new VersionedWriteLock()
	}
	load(txn: Transaction): T {
		if (txn.writeSet.has(this)) {
			return txn.writeSet.get(this) as T
		}

		if (this[VarLock].locked || this[VarLock].version > txn.rv) {
			abortAndRetry(txn)
			throw new VersionConflictError()
		}

		const value = this[VarValue]
		txn.readSet.push(this)
		return value
	}
	store(txn: Transaction, value: T) {
		txn.writeSet.set(this, value)
	}
}

type Speculative = (txn: Transaction) => void | Promise<void>

export async function atomically(speculative: Speculative) {
	const txn = new Transaction()
	await runWithTxn(globalVersionLock, txn, speculative)
}

async function runWithTxn(
	versionLock: VersionLock,
	txn: Transaction,
	speculative: Speculative,
) {
	while (true) {
		txn.retry = false
		// Step1: sample global version-clock
		txn.rv = versionLock.load()

		// Step2: run through a speculative execution
		try {
			await speculative(txn)
		} catch (err) {
			if (!(err instanceof VersionConflictError)) {
				throw err
			}
		}
		if (txn.retry) {
			continue
		}

		// optimize: if this is a read-only txn, all works done.
		if (txn.writeSet.size === 0) {
			return
		}

		// Step3: lock the write-set
		for (const writeVar of txn.writeSet.keys()) {
			const lock = writeVar[VarLock].tryAcquire()
			if (!lock) {
				abortAndRetry(txn)
				break
			}
			txn.locked.push(writeVar)
		}
		if (txn.retry) {
			continue
		}

		// Step4: increment global version-clock
		const writeVersion = versionLock.increment()

		// Step5: validate the read-set
		if (writeVersion === txn.rv + 1) {
			// optimize: it means we are the only writer, so no need to validate the read set
		} else {
			for (const readVar of txn.readSet) {
				let lockedByMe = false
				const readLock = readVar[VarLock]
				if (readLock.locked) {
					lockedByMe = txn.writeSet.has(readVar)
				}
				if (
					(readLock.locked && !lockedByMe) ||
					readLock.version > txn.rv
				) {
					abortAndRetry(txn)
					break
				}
			}
			if (txn.retry) {
				continue
			}
		}

		// Step6: commit and free lock
		commitTxn(txn, writeVersion)
		return
	}
}

function abortAndRetry(txn: Transaction) {
	txn.rv = 0
	txn.retry = true
	txn.readSet = []
	txn.writeSet = new Map()
	for (const writeVar of txn.locked) {
		writeVar[VarLock].release()
	}
	txn.locked = []
}

function commitTxn(txn: Transaction, writeVersion: number) {
	for (const [writeVar, value] of txn.writeSet.entries()) {
		writeVar[VarValue] = value
		writeVar[VarLock].commit(writeVersion)
	}
}
