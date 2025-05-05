import { Deferred } from "../ds/deferred"

export interface IOReader {
	peek(): Promise<string | undefined>
	peek(n: number): Promise<string | undefined>
	advance(): Promise<void>
	advance(n: number): Promise<void>
	mark: () => Promise<number>
	unmark: (m: number) => Promise<void>
	backTo(m: number): Promise<void>
}
export interface IOWriter<T> {
	write?(data: T): Promise<void>
	close?(): Promise<void>
	error?(err: Error): Promise<void>
}
export interface IO<T> {
	reader: IOReader
	writer: IOWriter<T>
}

///

export class BufIO<T = unknown> implements IO<T> {
	public reader: IOReader
	public writer: IOWriter<T>
	constructor(s: string, writer: IOWriter<T> = {}) {
		this.reader = new BufferedStr(s)
		this.writer = writer
	}
}
class BufferedStr implements IOReader {
	private str: string
	private idx: number
	constructor(s: string) {
		this.str = s
		this.idx = 0
	}
	async peek(n = 1) {
		if (n === 1) {
			return this.str[this.idx]
		} else if (this.idx + n <= this.str.length) {
			return this.str.slice(this.idx, this.idx + n)
		} else {
			return undefined
		}
	}
	async advance(n = 1) {
		this.idx += n
	}
	async mark() {
		return this.idx
	}
	async unmark() {}
	async backTo(m: number) {
		this.idx = m
	}
}

///

export class StreamIO<T> implements IO<T> {
	public reader: IOReader
	public writer: IOWriter<T>
	constructor(writer: IOWriter<T> = {}) {
		this.reader = new StreamingStr()
		this.writer = writer
	}
	public write(data: string) {
		;(this.reader as StreamingStr).write(data)
	}
	public end() {
		;(this.reader as StreamingStr).end()
	}
}
class StreamingStr implements IOReader {
	private len: number
	private buf: string
	private bufStart: number
	private bufCurr: number
	private marks: Record<string, number>
	private peekDeferred: Deferred<string> | null
	private peekSize: number
	constructor() {
		this.len = Infinity
		this.buf = ""
		this.bufStart = 0
		this.bufCurr = 0
		this.marks = {}
		this.peekDeferred = null
		this.peekSize = 0
	}
	write(data: string) {
		this.buf += data
		if (this.peekDeferred === null) return
		if (this.bufCurr + this.peekSize < this.buf.length) {
			const data = this.buf.slice(
				this.bufStart,
				this.bufStart + this.peekSize,
			)
			this.bufStart += this.peekSize
			this.peekDeferred.resolve(data)
			this.peekDeferred = null
		}
	}
	end() {
		this.len = this.buf.length + this.bufStart
	}
	async peek(n = 1) {
		if (this.bufCurr + n > this.len) return undefined
		if (this.bufCurr + n < this.buf.length) {
			const data = this.buf.slice(this.bufStart, this.bufStart + n)
			this.bufStart += n
			return data
		} else {
			this.peekDeferred = new Deferred()
			this.peekSize = n
			return this.peekDeferred.promise
		}
	}
	async advance(n = 1) {
		this.bufCurr += n
	}
	async mark() {
		this.marks[this.bufCurr] = (this.marks[this.bufCurr] ?? 0) + 1
		return this.bufCurr
	}
	async unmark(m: number) {
		const count = (this.marks[m] ?? 1) - 1
		this.marks[m] = count
		if (count === 0) {
			this.tryCleanupMark()
		}
	}
	private tryCleanupMark() {
		let minPos = this.bufCurr
		let newMarks: Record<string, number> = {}
		for (const [k, v] of Object.entries(this.marks)) {
			if (v > 0) {
				newMarks[k] = v
			}
		}
		this.marks = newMarks
		if (minPos > this.bufStart) {
			this.buf = this.buf.slice(minPos - this.bufStart)
			this.bufStart = minPos
		}
	}
	async backTo(m: number) {
		this.bufCurr = m
	}
}
