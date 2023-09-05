import { none, some, type Option } from "../option.ts"

const assert = (c: boolean, msg?: string): void => {
	if (!c) throw new Error(msg)
}

export class BTree<K extends string | number, V> {
	private root: Page<K, V>
	private degree: number
	constructor(degree: number = 8, root?: Page<K, V>) {
		assert(degree >= 2)
		this.root = root ?? new Page(degree)
		this.degree = degree
	}
	toString() {
		return this.root.toString()
	}
	has(key: K): boolean {
		return this.root.has(key)
	}
	get(key: K): Option<V> {
		return this.root.get(key)
	}
	set(key: K, value: V): BTree<K, V> {
		const root = this.root.set(key, value)
		if (root === null) return this
		return new BTree<K, V>(this.degree, root)
	}
	delete(key: K): BTree<K, V> {
		const root = this.root.delete(key)
		if (root === null) return this
		return new BTree<K, V>(this.degree, root)
	}
	keys(): IterableIterator<K> {
		return this.root.iterKeys()
	}
	values(): IterableIterator<V> {
		return this.root.iterValues()
	}
	entries(): IterableIterator<[K, V]> {
		return this.root.iterEntries()
	}
}

class Page<K, V> {
	degree: number
	minKeys: number
	maxKeys: number
	// children[i].keys < keys[i] <= children[i+1].keys
	keys: K[]
	values: V[] // leaf
	children: Page<K, V>[] // non-leaf
	constructor(degree: number) {
		this.degree = degree
		this.minKeys = degree - 1
		this.maxKeys = degree * 2 - 1
		this.keys = []
		this.values = []
		this.children = []
	}
	valueOf(): unknown {
		if (this.isBranch()) {
			return {
				keys: this.keys,
				children: this.children.map((c) => c.valueOf()),
			}
		} else {
			return {
				leaf: this.values.map((v, idx) => this.keys[idx] + "=" + v),
			}
		}
	}
	toString() {
		return JSON.stringify(this.valueOf(), null, 4)
	}
	///
	*iterKeys(): IterableIterator<K> {
		const c = new Cursor(this)
		let found = c.first()
		while (found) {
			yield c.getKey()
			found = c.next()
		}
	}
	*iterValues(): IterableIterator<V> {
		const c = new Cursor(this)
		let found = c.first()
		while (found) {
			yield c.getValue()
			found = c.next()
		}
	}
	*iterEntries(): IterableIterator<[K, V]> {
		const c = new Cursor(this)
		let found = c.first()
		while (found) {
			yield [c.getKey(), c.getValue()]
			found = c.next()
		}
	}
	///
	has(key: K): boolean {
		const c = new Cursor(this)
		c.seek(key)
		return c.getKey() === key
	}
	get(key: K): Option<V> {
		const c = new Cursor(this)
		c.seek(key)
		if (c.getKey() === key) {
			return some(c.getValue())
		} else {
			return none
		}
	}
	set(key: K, value: V): Page<K, V> | null {
		const c = new Cursor(this)
		c.seek(key)
		if (c.getKey() === key) {
			if (c.getValue() === value) {
				return null
			} else {
				return c.setValue(value)
			}
		}
		return c.addItem(key, value)
	}
	delete(key: K): Page<K, V> | null {
		const c = new Cursor(this)
		c.seek(key)
		if (c.getKey() === key) {
			return c.deleteItem()
		} else {
			return null
		}
	}
	///
	clone(): Page<K, V> {
		const node = new Page<K, V>(this.degree)
		node.keys = [...this.keys]
		if (this.isBranch()) {
			node.children = [...this.children]
		} else {
			node.values = [...this.values]
		}
		return node
	}
	isBranch(): boolean {
		return this.children.length > 0
	}
	findIndex(key: K): number {
		if (this.isBranch()) {
			for (let i = 0, len = this.keys.length; i < len; i++) {
				if (key < this.keys[i]!) {
					return i
				}
			}
			return this.keys.length
		} else {
			for (let i = 0, len = this.keys.length; i < len; i++) {
				if (key <= this.keys[i]!) {
					return i
				}
			}
			return this.keys.length
		}
	}
	_split(): { newKey: K; leftChild: Page<K, V>; rightChild: Page<K, V> } {
		const idx = Math.floor(this.maxKeys / 2)
		const newKey = this.keys[idx]!
		const leftChild = new Page<K, V>(this.degree)
		const rightChild = new Page<K, V>(this.degree)

		if (this.isBranch()) {
			leftChild.keys = this.keys.slice(0, idx)
			leftChild.children = this.children.slice(0, idx + 1)

			rightChild.keys = this.keys.slice(idx + 1)
			rightChild.children = this.children.slice(idx + 1)
		} else {
			leftChild.keys = this.keys.slice(0, idx)
			leftChild.values = this.values.slice(0, idx)

			rightChild.keys = this.keys.slice(idx)
			rightChild.values = this.values.slice(idx)
		}

		return { newKey, leftChild, rightChild }
	}
	_mergeChildren(idx: number) {
		const child = this.children[idx]!
		if (child.isBranch()) {
			this._mergeBranch(idx)
		} else {
			this._mergeLeaf(idx)
		}
	}
	private _mergeBranch(idx: number): void {
		if (idx === 0) {
			const left = this.children[0]!.clone()
			const right = this.children[1]!.clone()
			if (right.keys.length > this.minKeys) {
				// steal from right child
				// move parent key to left child
				const currentKey = this.keys[idx]!
				left.keys.push(currentKey)
				// move right child key to parent
				const stolenKey = right.keys.shift()!
				this.keys[idx] = stolenKey
				// move right child to left
				const stolenChild = right.children.shift()!
				left.children.push(stolenChild)
				// update children
				this.children[0] = left
				this.children[1] = right
			} else {
				// merge with right child
				// move parent key to left child
				const currentKey = this.keys[idx]!
				left.keys.push(currentKey)
				// merge keys and children
				left.keys.push(...right.keys)
				left.children.push(...right.children)
				// fix keys and chidlren
				this.keys.splice(idx, 1)
				this.children.splice(idx, 2, left)
			}
		} else {
			const left = this.children[idx - 1]!.clone()
			const right = this.children[idx]!.clone()
			if (left.keys.length > this.minKeys) {
				// steal from left child
				// move parent key to right child
				const currentKey = this.keys[idx]!
				right.keys.unshift(currentKey)
				// move left child key to parent
				const stolenKey = left.keys.pop()!
				this.keys[idx] = stolenKey
				// move left child to right
				const stolenChild = left.children.pop()!
				right.children.unshift(stolenChild)
				// update children
				this.children[idx - 1] = left
				this.children[idx] = right
			} else {
				// merge with left child
				// move parent key to left child
				const currentKey = this.keys[idx - 1]!
				left.keys.push(currentKey)
				// merge keys and children
				left.keys.push(...right.keys)
				left.children.push(...right.children)
				// fix keys and chidlren
				this.keys.splice(idx - 1, 1)
				this.children.splice(idx - 1, 2, left)
			}
		}
	}
	private _mergeLeaf(idx: number): void {
		if (idx === 0) {
			const left = this.children[0]!.clone()
			const right = this.children[1]!.clone()
			if (right.keys.length > this.minKeys) {
				// steal from right child
				const stolenKey = right.keys.shift()!
				this.keys[idx] = right.keys[0]!
				left.keys.push(stolenKey)
				const stolenValue = right.values.shift()!
				left.values.push(stolenValue)
				// update children
				this.children[0] = left
				this.children[1] = right
			} else {
				// merge with right child
				left.keys.push(...right.keys)
				left.values.push(...right.values)
				this.keys.splice(idx, 1)
				this.children.splice(idx, 2, left)
			}
		} else {
			const left = this.children[idx - 1]!.clone()
			const right = this.children[idx]!.clone()
			if (left.keys.length > this.minKeys) {
				// steal from left child
				const stolenKey = left.keys.pop()!
				this.keys[idx] = stolenKey
				right.keys.unshift(stolenKey)
				const stolenValue = left.values.pop()!
				right.values.unshift(stolenValue)
				// update children
				this.children[idx - 1] = left
				this.children[idx] = right
			} else {
				// merge with left child
				left.keys.push(...right.keys)
				left.values.push(...right.values)
				this.keys.splice(idx - 1, 1)
				this.children.splice(idx - 1, 2, left)
			}
		}
	}
}

class Cursor<K, V> {
	root: Page<K, V>
	path: Page<K, V>[]
	idx: number[]
	constructor(root: Page<K, V>) {
		this.root = root
		this.path = []
		this.idx = []
	}
	///
	seek(key: K): void {
		this.path = []
		this.idx = []
		let curr: Page<K, V> | undefined = this.root
		while (curr) {
			const idx = curr.findIndex(key)
			this.path.push(curr)
			this.idx.push(idx)
			curr = curr.children[idx]
		}
	}
	first(): boolean {
		this.path = []
		this.idx = []
		let curr: Page<K, V> = this.root
		while (curr.isBranch()) {
			this.path.push(curr)
			this.idx.push(0)
			curr = curr.children[0]!
		}
		this.path.push(curr)
		this.idx.push(0)
		return curr.values.length > 0
	}
	last(): boolean {
		this.path = []
		this.idx = []
		let curr: Page<K, V> = this.root
		while (curr.isBranch()) {
			this.path.push(curr)
			const idx = curr.children.length - 1
			this.idx.push(idx)
			curr = curr.children[idx]!
		}
		this.path.push(curr)
		const idx = curr.values.length - 1
		this.idx.push(idx)
		return curr.values.length > 0
	}
	next(): boolean {
		const pos = this.path.length - 1
		assert(pos >= 0)

		const hasNext = this._moveToNextLeaf()
		if (hasNext) return true

		let hasParent = this._moveToParent()
		while (hasParent) {
			const hasNext = this._moveToNextBranch()
			if (hasNext) {
				this._moveToFirstLeaf()
				return true
			} else {
				hasParent = this._moveToParent()
			}
		}
		return false
	}
	prev(): boolean {
		const pos = this.path.length - 1
		assert(pos >= 0)

		const hasPrev = this._moveToPrevLeaf()
		if (hasPrev) return true

		let hasParent = this._moveToParent()
		while (hasParent) {
			const hasPrev = this._moveToPrevBranch()
			if (hasPrev) {
				this._moveToLastLeaf()
				return true
			} else {
				hasParent = this._moveToParent()
			}
		}
		return false
	}
	///
	private _moveToParent(): boolean {
		this.path.pop()
		this.idx.pop()
		return this.path.length > 0
	}
	private _moveToNextLeaf(): boolean {
		const pos = this.path.length - 1
		const page = this.path[pos]!
		assert(!page.isBranch())
		const idx = this.idx[pos]!
		if (idx + 1 < page.values.length) {
			this.idx[pos] = idx + 1
			return true
		} else {
			return false
		}
	}
	private _moveToPrevLeaf(): boolean {
		const pos = this.path.length - 1
		const page = this.path[pos]!
		assert(!page.isBranch())
		const idx = this.idx[pos]!
		if (idx - 1 >= 0) {
			this.idx[pos] = idx - 1
			return true
		} else {
			return false
		}
	}
	private _moveToNextBranch(): boolean {
		const pos = this.path.length - 1
		const page = this.path[pos]!
		assert(page.isBranch())
		const idx = this.idx[pos]!
		if (idx + 1 < page.children.length) {
			this.idx[pos] = idx + 1
			return true
		} else {
			return false
		}
	}
	private _moveToPrevBranch(): boolean {
		const pos = this.path.length - 1
		const page = this.path[pos]!
		assert(page.isBranch())
		const idx = this.idx[pos]!
		if (idx - 1 >= 0) {
			this.idx[pos] = idx - 1
			return true
		} else {
			return false
		}
	}
	private _moveToFirstLeaf(): void {
		const pos = this.path.length - 1
		const page = this.path[pos]!
		const idx = this.idx[pos]!
		let curr: Page<K, V> | undefined = page.children[idx]
		while (curr) {
			this.path.push(curr)
			this.idx.push(0)
			curr = curr.children[0]
		}
	}
	private _moveToLastLeaf(): void {
		const pos = this.path.length - 1
		const page = this.path[pos]!
		const idx = this.idx[pos]!
		let curr: Page<K, V> | undefined = page.children[idx]
		while (curr) {
			this.path.push(curr)
			const idx = curr.children.length - 1
			this.idx.push(idx)
			curr = curr.children[idx]
		}
	}
	///
	getKey(): K {
		const pos = this.path.length - 1
		assert(pos >= 0)
		const page = this.path[pos]!
		const idx = this.idx[pos]!
		return page.keys[idx]!
	}
	getValue(): V {
		const pos = this.path.length - 1
		assert(pos >= 0)
		const page = this.path[pos]!
		const idx = this.idx[pos]!
		return page.values[idx]!
	}
	setValue(value: V): Page<K, V> {
		// update value
		const pos = this.path.length - 1
		assert(pos >= 0)
		const page = this.path[pos]!.clone()
		const idx = this.idx[pos]!
		page.values[idx] = value
		// copy all pages
		let prev = page
		for (let i = this.path.length - 2; i >= 0; i--) {
			const page = this.path[i]!.clone()
			const idx = this.idx[i]!
			page.children[idx] = prev
			prev = page
		}
		return prev
	}
	addItem(key: K, value: V): Page<K, V> {
		// update value
		const pos = this.path.length - 1
		assert(pos >= 0)
		const page = this.path[pos]!.clone()
		const idx = this.idx[pos]!
		page.keys.splice(idx, 0, key)
		page.values.splice(idx, 0, value)
		// copy all pages
		let prev = page
		for (let i = this.path.length - 2; i >= 0; i--) {
			const page = this.path[i]!.clone()
			const idx = this.idx[i]!
			page.children[idx] = prev
			if (prev.keys.length > prev.maxKeys) {
				const { newKey, leftChild, rightChild } = prev._split()
				page.keys.splice(idx, 0, newKey)
				page.children.splice(idx, 1, leftChild, rightChild)
			}
			prev = page
		}
		// split if root is full
		if (prev.keys.length > prev.maxKeys) {
			const { newKey, leftChild, rightChild } = prev._split()
			const newRoot = new Page<K, V>(prev.degree)
			newRoot.keys.push(newKey)
			newRoot.children.push(leftChild, rightChild)
			return newRoot
		} else {
			return prev
		}
	}
	deleteItem(): Page<K, V> {
		// update value
		const pos = this.path.length - 1
		assert(pos >= 0)
		const page = this.path[pos]!.clone()
		const idx = this.idx[pos]!
		page.keys.splice(idx, 1)
		page.values.splice(idx, 1)
		// copy all pages
		let prev = page
		for (let i = this.path.length - 2; i >= 0; i--) {
			const page = this.path[i]!.clone()
			const idx = this.idx[i]!
			page.children[idx] = prev
			if (prev.keys.length < prev.minKeys) {
				page._mergeChildren(idx)
			}
			prev = page
		}
		// return child if root is empty
		if (prev.keys.length === 0 && prev.children.length === 1) {
			return prev.children[0]!
		} else {
			return prev
		}
	}
}
