import { assert } from "../assert.js"

class Entry<T> {
	// children[i].keys < keys[i] <= children[i+1].keys
	keys: T[]
	children: Entry<T>[] // non-leaf
	constructor() {
		this.keys = []
		this.children = []
	}
	valueOf(): unknown {
		if (this.isLeaf()) {
			return this.keys
		} else {
			return {
				keys: this.keys,
				children: this.children.map((c) => c.valueOf()),
			}
		}
	}
	toString(): string {
		return JSON.stringify(this.valueOf(), null, 4)
	}
	isLeaf(): boolean {
		return this.children.length === 0
	}
	search(key: T): number {
		let i = 0
		const len = this.keys.length
		while (i < len) {
			if (key <= this.keys[i]!) {
				return i
			} else {
				i++
			}
		}
		return i
	}
	has(key: T): boolean {
		const idx = this.search(key)
		if (this.isLeaf()) {
			return this.keys[idx] === key
		} else {
			if (this.children[idx]) {
				return this.children[idx]!.has(key)
			} else {
				return false
			}
		}
	}
	add(key: T, maxKeys: number): boolean {
		const idx = this.search(key)
		if (this.isLeaf()) {
			if (this.keys[idx] === key) {
				return false
			} else {
				this.keys.splice(idx, 0, key)
				return true
			}
		} else {
			if (this.maybeSplitChild(idx, maxKeys)) {
				return this.add(key, maxKeys)
			} else {
				return this.children[idx]!.add(key, maxKeys)
			}
		}
	}
	remove(key: T, minKeys: number): boolean {
		const idx = this.search(key)
		if (this.isLeaf()) {
			if (this.keys[idx] === key) {
				this.keys.splice(idx, 1)
				return true
			} else {
				return false
			}
		} else {
			if (this.maybeGrowChild(idx, minKeys)) {
				return this.remove(key, minKeys)
			} else {
				return this.children[idx]!.remove(key, minKeys)
			}
		}
	}
	///
	split(idx: number): {
		newKey: T
		leftChild: Entry<T>
		rightChild: Entry<T>
	} {
		const newKey = this.keys[idx]!
		const leftChild = this as Entry<T>
		const rightChild = new Entry<T>()

		rightChild.keys = this.keys.slice(idx + 1)
		rightChild.children = this.children.slice(idx + 1)
		if (rightChild.isLeaf()) {
			rightChild.keys.unshift(newKey)
		}

		leftChild.keys = this.keys.slice(0, idx)
		leftChild.children = this.children.slice(0, idx + 1)

		return { newKey, leftChild, rightChild }
	}
	// true, if splitted
	private maybeSplitChild(idx: number, maxKeys: number): boolean {
		if (this.children[idx]!.keys.length < maxKeys) {
			return false
		}
		const node = this.children[idx]!
		const { newKey, leftChild, rightChild } = node.split(
			Math.floor(maxKeys / 2),
		)
		this.keys.splice(idx, 0, newKey)
		this.children.splice(idx, 1, leftChild, rightChild)
		return true
	}
	// true, if grew
	private maybeGrowChild(idx: number, minKeys: number): boolean {
		if (this.children[idx]!.keys.length > minKeys) {
			return false
		}
		if (this.children[idx]!.isLeaf()) {
			if (idx > 0 && this.children[idx - 1]!.keys.length > minKeys) {
				// steal from left child
				const left = this.children[idx - 1]!
				const right = this.children[idx]!

				const stolenKey = left.keys.pop()!
				this.keys[idx] = stolenKey
				right.keys.unshift(stolenKey)
			} else if (
				idx < this.keys.length &&
				this.children[idx + 1]!.keys.length > minKeys
			) {
				// steal from right child
				const left = this.children[idx]!
				const right = this.children[idx + 1]!

				const stolenKey = right.keys.shift()!
				this.keys[idx] = right.keys[0]!
				left.keys.push(stolenKey)
			} else {
				if (idx >= this.keys.length) {
					// merge with left child
					idx--
				} else {
					// merge with right child
				}
				const left = this.children[idx]!
				const right = this.children[idx + 1]!

				left.keys.push(...right.keys)
				this.keys.splice(idx, 1)
				this.children.splice(idx + 1, 1)
			}
		} else {
			if (idx > 0 && this.children[idx - 1]!.keys.length > minKeys) {
				// steal from left child
				const left = this.children[idx - 1]!
				const right = this.children[idx]!

				// move to right
				const currentKey = this.keys[idx]!
				right.keys.unshift(currentKey)

				// move to parent
				const stolenKey = left.keys.pop()!
				this.keys[idx] = stolenKey

				// move to right
				const stolenChild = left.children.pop()!
				right.children.unshift(stolenChild)
			} else if (
				idx < this.keys.length &&
				this.children[idx + 1]!.keys.length > minKeys
			) {
				// steal from right child
				const left = this.children[idx]!
				const right = this.children[idx + 1]!

				// move to left
				const currentKey = this.keys[idx]!
				left.keys.push(currentKey)

				// move to parent
				const stolenKey = right.keys.shift()!
				this.keys[idx] = stolenKey

				// move to left
				const stolenChild = right.children.shift()!
				left.children.push(stolenChild)
			} else {
				if (idx >= this.keys.length) {
					// merge with left child
					idx--
				} else {
					// merge with right child
				}
				const left = this.children[idx]!
				const right = this.children[idx + 1]!

				// move to child
				const currentKey = this.keys[idx]!
				left.keys.push(currentKey)

				// merge keys and children
				left.keys.push(...right.keys)
				left.children.push(...right.children)

				// fix keys and chidlren
				this.keys.splice(idx, 1)
				this.children.splice(idx + 1, 1)
			}
		}
		return true
	}
}

export class BTree<T> {
	private root: Entry<T>
	private minKeys: number
	private maxKeys: number
	constructor(degree: number = 2) {
		assert(degree >= 2)
		this.root = new Entry()
		this.minKeys = degree - 1
		this.maxKeys = degree * 2 - 1
	}
	toString() {
		return JSON.stringify(this.root.valueOf(), null, 4)
	}
	// true, if existed
	has(key: T): boolean {
		return this.root.has(key)
	}
	// true, if added
	// false, if existed
	add(key: T): boolean {
		if (this.root.keys.length >= this.maxKeys) {
			const { newKey, leftChild, rightChild } = this.root.split(
				Math.floor(this.maxKeys / 2),
			)
			this.root = new Entry()
			this.root.keys = [newKey]
			this.root.children = [leftChild, rightChild]
		}
		return this.root.add(key, this.maxKeys)
	}
	// true, if removed
	// false, if not existed
	remove(key: T): boolean {
		if (this.root.keys.length === 0) return false
		const removed = this.root.remove(key, this.minKeys)
		if (this.root.keys.length === 0 && this.root.children.length > 0) {
			this.root = this.root.children[0]!
		}
		return removed
	}
}
