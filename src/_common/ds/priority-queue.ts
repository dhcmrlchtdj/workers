// https://github.com/lemire/FastPriorityQueue.js

export class PriorityQueue<T> {
	private array: T[]
	private size: number
	private lessThan: (a: T, b: T) => boolean
	constructor(lessThan: (a: T, b: T) => boolean) {
		this.array = []
		this.size = 0
		this.lessThan = lessThan
	}
	isEmpty(): boolean {
		return this.size === 0
	}
	add(val: T): void {
		let i = this.size
		this.array[this.size] = val
		this.size++
		while (i > 0) {
			let p = (i - 1) >>> 1
			let ap = this.array[p]!
			if (!this.lessThan(val, ap)) {
				break
			}
			this.array[i] = ap
			i = p
		}
		this.array[i] = val
	}
	poll(): T | undefined {
		if (this.size === 0) return undefined
		const ans = this.array[0]
		if (this.size > 1) {
			this.size--
			this.array[0] = this.array[this.size]!
			this._percolateDown(0)
		} else {
			this.size -= 1
		}
		return ans
	}
	private _percolateDown(i: number) {
		var size = this.size
		var hsize = this.size >>> 1
		var ai = this.array[i]!
		while (i < hsize) {
			let l = (i << 1) + 1
			let r = l + 1
			let bestc = this.array[l]!
			if (r < size && this.lessThan(this.array[r]!, bestc)) {
				l = r
				bestc = this.array[r]!
			}
			if (!this.lessThan(bestc, ai)) {
				break
			}
			this.array[i] = bestc
			i = l
		}
		this.array[i] = ai
	}
}
