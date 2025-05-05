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
	private eof: boolean
	private buf: string
	private idx: number
	private start: number
	private marks: Map<number, number>
	private peekDeferred: Deferred<string | undefined> | null
	private peekSize: number
	constructor() {
		this.eof = false
		this.buf = ""
		this.idx = 0
		this.start = 0
		this.marks = new Map()
		this.peekDeferred = null
		this.peekSize = 0
	}
	write(data: string) {
		this.buf += data
		if (this.peekDeferred === null) return
		if (this.idx + this.peekSize < this.buf.length) {
			const chunk = this.buf.slice(this.idx, this.idx + this.peekSize)
			this.peekDeferred.resolve(chunk)
			this.peekDeferred = null
		}
	}
	end() {
		this.eof = true
		if (this.peekDeferred !== null) {
			this.peekDeferred.resolve(undefined)
		}
	}
	async peek(n = 1) {
		if (this.idx + n < this.buf.length) {
			if (n === 1) return this.buf[this.idx + 1]
			const chunk = this.buf.slice(this.idx, this.idx + n)
			return chunk
		} else if (this.eof) {
			return undefined
		} else {
			this.peekDeferred = new Deferred()
			this.peekSize = n
			return this.peekDeferred.promise
		}
	}
	async advance(n = 1) {
		this.idx += n
		this._cleanup()
	}
	async mark() {
		const pos = this.start + this.idx
		const count = (this.marks.get(pos) ?? 0) + 1
		this.marks.set(pos, count)
		return pos
	}
	async unmark(m: number) {
		const count = (this.marks.get(m) ?? 1) - 1
		if (count > 0) {
			this.marks.set(m, count)
		} else {
			this.marks.delete(m)
			this._cleanup()
		}
	}
	async backTo(m: number) {
		this.idx = m - this.start
	}
	private _cleanup() {
		if (Math.random() > 0.2) return
		const minPos = Math.min(this.start + this.idx, ...this.marks.keys())
		if (minPos > this.start) {
			const shift = minPos - this.start
			this.buf = this.buf.slice(shift)
			this.idx -= shift
			this.start = minPos
		}
	}
}
