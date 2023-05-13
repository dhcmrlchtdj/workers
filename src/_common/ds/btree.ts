import { assert } from "../assert.js"
import { none, some, type Option } from "../option.js"

type PageMap<K extends string | number, V> = Record<number, Page<K, V>>
let PAGE_ID = 1

export class BTree<K extends string | number, V> {
	private pageMap: PageMap<K, V>
	constructor(degree: number = 8) {
		assert(degree >= 2)
		const minKeys = degree - 1
		const maxKeys = degree * 2 - 1
		const root = new Page<K, V>(minKeys, maxKeys)
		this.pageMap = { 0: root }
	}
	///
	toString() {
		const root = this.pageMap[0]!
		return root.toString(this.pageMap)
	}
	///
	has(key: K): boolean {
		const root = this.pageMap[0]!
		return root.has(this.pageMap, key)
	}
	get(key: K): Option<V> {
		const root = this.pageMap[0]!
		return root.get(this.pageMap, key)
	}
	set(key: K, value: V): BTree<K, V> {
		const root = this.pageMap[0]!
		const newPageMap = root.set(this.pageMap, key, value)
		if (newPageMap === null) {
			return this
		} else {
			const newTree = new BTree<K, V>()
			newTree.pageMap = newPageMap
			return newTree
		}
	}
	delete(key: K): BTree<K, V> {
		const root = this.pageMap[0]!
		const newPageMap = root.delete(this.pageMap, key)
		if (newPageMap === null) {
			return this
		} else {
			const newTree = new BTree<K, V>()
			newTree.pageMap = newPageMap
			return newTree
		}
	}
	///
	keys(): IterableIterator<K> {
		const root = this.pageMap[0]!
		return root.iterKeys(this.pageMap)
	}
	values(): IterableIterator<V> {
		const root = this.pageMap[0]!
		return root.iterValues(this.pageMap)
	}
	entries(): IterableIterator<[K, V]> {
		const root = this.pageMap[0]!
		return root.iterEntries(this.pageMap)
	}
}

class Page<K extends string | number, V> {
	minKeys: number
	maxKeys: number
	// children[i].keys < keys[i] <= children[i+1].keys
	keys: K[]
	values: V[] // leaf
	children: number[] // non-leaf
	prevPage: number | null
	nextPage: number | null
	constructor(minKeys: number, maxKeys: number) {
		this.minKeys = minKeys
		this.maxKeys = maxKeys
		this.keys = []
		this.values = []
		this.children = []
		this.prevPage = null
		this.nextPage = null
	}
	///
	valueOf(pageMap: PageMap<K, V>): unknown {
		if (this.isBranch()) {
			return {
				keys: this.keys,
				children: this.children.map((c) =>
					pageMap[c]!.valueOf(pageMap),
				),
			}
		} else {
			return {
				leaf: this.values.map((v, idx) => `${this.keys[idx]}=${v}`),
			}
		}
	}
	toString(pageMap: PageMap<K, V>) {
		return JSON.stringify(this.valueOf(pageMap), null, 4)
	}
	///
	*iterKeys(pageMap: PageMap<K, V>): IterableIterator<K> {
		const c = new Cursor(pageMap)
		let found = c.first()
		while (found) {
			yield c.getKey()
			found = c.next()
		}
	}
	*iterValues(pageMap: PageMap<K, V>): IterableIterator<V> {
		const c = new Cursor(pageMap)
		let found = c.first()
		while (found) {
			yield c.getValue()
			found = c.next()
		}
	}
	*iterEntries(pageMap: PageMap<K, V>): IterableIterator<[K, V]> {
		const c = new Cursor(pageMap)
		let found = c.first()
		while (found) {
			yield [c.getKey(), c.getValue()]
			found = c.next()
		}
	}
	///
	has(pageMap: PageMap<K, V>, key: K): boolean {
		const c = new Cursor(pageMap)
		c.seek(key)
		return c.getKey() === key
	}
	get(pageMap: PageMap<K, V>, key: K): Option<V> {
		const c = new Cursor(pageMap)
		c.seek(key)
		if (c.getKey() === key) {
			return some(c.getValue())
		} else {
			return none
		}
	}
	set(pageMap: PageMap<K, V>, key: K, value: V): PageMap<K, V> | null {
		const c = new Cursor(pageMap)
		c.seek(key)
		if (c.getKey() === key) {
			if (c.getValue() === value) {
				return null
			} else {
				const newPageMap = c.clonePageMap()
				c.setValue(value)
				return newPageMap
			}
		} else {
			const newPageMap = c.clonePageMap()
			c.addItem(key, value)
			return newPageMap
		}
	}
	delete(pageMap: PageMap<K, V>, key: K): PageMap<K, V> | null {
		const c = new Cursor(pageMap)
		c.seek(key)
		if (c.getKey() === key) {
			const newPageMap = c.clonePageMap()
			c.deleteItem()
			return newPageMap
		} else {
			return null
		}
	}
	///
	getChild(pageMap: PageMap<K, V>, idx: number): Page<K, V> | undefined {
		const childId = this.children[idx]!
		return pageMap[childId]
	}
	cloneChild(pageMap: PageMap<K, V>, idx: number): Page<K, V> | undefined {
		const childId = this.children[idx]!
		const child = pageMap[childId]
		if (child) {
			const cloned = child._clone()
			pageMap[childId] = cloned
			return cloned
		} else {
			return undefined
		}
	}
	cloneSelf(pageMap: PageMap<K, V>, pageId: number): Page<K, V> | undefined {
		const page = pageMap[pageId]
		if (page) {
			const cloned = page._clone()
			pageMap[pageId] = cloned
			return cloned
		} else {
			return undefined
		}
	}
	private _clone(): Page<K, V> {
		const node = new Page<K, V>(this.minKeys, this.maxKeys)
		node.keys = [...this.keys]
		if (this.isBranch()) {
			node.children = [...this.children]
		} else {
			node.values = [...this.values]
		}
		node.prevPage = this.prevPage
		node.nextPage = this.nextPage
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
		const leftChild = new Page<K, V>(this.minKeys, this.maxKeys)
		const rightChild = new Page<K, V>(this.minKeys, this.maxKeys)

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
	_mergeChildren(pageMap: PageMap<K, V>, idx: number) {
		const child = this.getChild(pageMap, idx)!
		if (child.isBranch()) {
			this._mergeBranch(pageMap, idx)
		} else {
			this._mergeLeaf(pageMap, idx)
		}
	}
	private _mergeBranch(pageMap: PageMap<K, V>, idx: number): void {
		if (idx === 0) {
			const left = this.cloneChild(pageMap, 0)!
			const right = this.cloneChild(pageMap, 1)!
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
			} else {
				// merge with right child
				// move parent key to left child
				const currentKey = this.keys[idx]!
				left.keys.push(currentKey)
				// merge keys and children
				left.keys.push(...right.keys)
				left.children.push(...right.children)
				// fix keys
				this.keys.splice(0, 1)
				// remove right child
				this.children.splice(1, 1)
				left._fixSibling(
					pageMap,
					left.prevPage,
					this.children[0]!,
					right.nextPage,
				)
			}
		} else {
			const left = this.cloneChild(pageMap, idx - 1)!
			const right = this.cloneChild(pageMap, idx)!
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
			} else {
				// merge with left child
				// move parent key to left child
				const currentKey = this.keys[idx - 1]!
				left.keys.push(currentKey)
				// merge keys and children
				left.keys.push(...right.keys)
				left.children.push(...right.children)
				// fix keys
				this.keys.splice(idx - 1, 1)
				// remove right child
				this.children.splice(idx, 1)
				left._fixSibling(
					pageMap,
					left.prevPage,
					this.children[idx - 1]!,
					right.nextPage,
				)
			}
		}
	}
	private _mergeLeaf(pageMap: PageMap<K, V>, idx: number): void {
		if (idx === 0) {
			const left = this.cloneChild(pageMap, 0)!
			const right = this.cloneChild(pageMap, 1)!
			if (right.keys.length > this.minKeys) {
				// steal from right child
				const stolenKey = right.keys.shift()!
				this.keys[idx] = right.keys[0]!
				left.keys.push(stolenKey)
				const stolenValue = right.values.shift()!
				left.values.push(stolenValue)
			} else {
				// merge with right child
				left.keys.push(...right.keys)
				left.values.push(...right.values)
				this.keys.splice(0, 1)
				this.children.splice(1, 1)
				left._fixSibling(
					pageMap,
					left.prevPage,
					this.children[0]!,
					right.nextPage,
				)
			}
		} else {
			const left = this.cloneChild(pageMap, idx - 1)!
			const right = this.cloneChild(pageMap, idx)!
			if (left.keys.length > this.minKeys) {
				// steal from left child
				const stolenKey = left.keys.pop()!
				this.keys[idx] = stolenKey
				right.keys.unshift(stolenKey)
				const stolenValue = left.values.pop()!
				right.values.unshift(stolenValue)
			} else {
				// merge with left child
				left.keys.push(...right.keys)
				left.values.push(...right.values)
				this.keys.splice(idx - 1, 1)
				this.children.splice(idx, 1)
				left._fixSibling(
					pageMap,
					left.prevPage,
					this.children[idx - 1]!,
					right.nextPage,
				)
			}
		}
	}
	_fixSibling(
		pageMap: PageMap<K, V>,
		prevId: number | null,
		currId: number,
		nextId: number | null,
	) {
		const curr = pageMap[currId]!
		if (prevId) {
			const prev = pageMap[prevId]!
			prev.nextPage = currId
			curr.prevPage = prevId
		} else {
			curr.prevPage = null
		}
		if (nextId) {
			const next = pageMap[nextId]!
			next.prevPage = currId
			curr.nextPage = nextId
		} else {
			curr.nextPage = null
		}
	}
}

class Cursor<K extends string | number, V> {
	pageMap: Record<number, Page<K, V>>
	pageId: number[]
	childIdx: number[]
	constructor(pageMap: Record<number, Page<K, V>>) {
		this.pageMap = pageMap
		this.pageId = []
		this.childIdx = []
	}
	///
	seek(key: K): void {
		this.pageId = []
		this.childIdx = []
		let currPageId: number = 0
		let currPage: Page<K, V> | undefined = this.pageMap[0]
		while (currPage) {
			const childIdx = currPage.findIndex(key)
			this.pageId.push(currPageId)
			this.childIdx.push(childIdx)
			currPageId = currPage.children[childIdx]!
			currPage = this.pageMap[currPageId]
		}
	}
	first(): boolean {
		this.pageId = []
		this.childIdx = []
		let currPageId: number = 0
		let currPage: Page<K, V> = this.pageMap[0]!
		while (currPage.isBranch()) {
			const childIdx = 0
			this.pageId.push(currPageId)
			this.childIdx.push(childIdx)
			currPageId = currPage.children[childIdx]!
			currPage = this.pageMap[currPageId]!
		}
		this.pageId.push(currPageId)
		this.childIdx.push(0)
		return currPage.values.length > 0
	}
	last(): boolean {
		this.pageId = []
		this.childIdx = []
		let currPageId: number = 0
		let currPage: Page<K, V> = this.pageMap[0]!
		while (currPage.isBranch()) {
			const childIdx = currPage.children.length - 1
			this.pageId.push(currPageId)
			this.childIdx.push(childIdx)
			currPageId = currPage.children[childIdx]!
			currPage = this.pageMap[currPageId]!
		}
		this.pageId.push(currPageId)
		this.childIdx.push(currPage.children.length - 1)
		return currPage.values.length > 0
	}
	next(): boolean {
		return this._moveToNext() || this._moveToNextLeaf()
	}
	prev(): boolean {
		return this._moveToPrev() || this._moveToPrevLeaf()
	}
	private _moveToNext(): boolean {
		const pos = this.pageId.length - 1
		const pageId = this.pageId[pos]!
		const childIdx = this.childIdx[pos]!
		const page = this.pageMap[pageId]!
		if (childIdx + 1 < page.values.length) {
			this.childIdx[pos] = childIdx + 1
			return true
		} else {
			return false
		}
	}
	private _moveToPrev(): boolean {
		const pos = this.pageId.length - 1
		const childIdx = this.childIdx[pos]!
		if (childIdx - 1 >= 0) {
			this.childIdx[pos] = childIdx - 1
			return true
		} else {
			return false
		}
	}
	private _moveToNextLeaf(): boolean {
		const pos = this.pageId.length - 1
		const pageId = this.pageId[pos]!
		const page = this.pageMap[pageId]!
		if (page.nextPage) {
			this.pageId[pos] = page.nextPage
			this.childIdx[pos] = 0
			return true
		} else {
			return false
		}
	}
	private _moveToPrevLeaf(): boolean {
		const pos = this.pageId.length - 1
		const pageId = this.pageId[pos]!
		const page = this.pageMap[pageId]!
		if (page.prevPage) {
			this.pageId[pos] = page.prevPage
			const prev = this.pageMap[page.prevPage]!
			this.childIdx[pos] = prev.values.length - 1
			return true
		} else {
			return false
		}
	}
	///
	clonePageMap(): PageMap<K, V> {
		const newPageMap = { ...this.pageMap }
		this.pageMap = newPageMap
		return newPageMap
	}
	getKey(): K {
		const pos = this.pageId.length - 1
		const pageId = this.pageId[pos]!
		const childIdx = this.childIdx[pos]!
		const page = this.pageMap[pageId]!
		return page.keys[childIdx]!
	}
	getValue(): V {
		const pos = this.pageId.length - 1
		const pageId = this.pageId[pos]!
		const childIdx = this.childIdx[pos]!
		const page = this.pageMap[pageId]!
		return page.values[childIdx]!
	}
	setValue(value: V): void {
		const pos = this.pageId.length - 1
		const pageId = this.pageId[pos]!
		const childIdx = this.childIdx[pos]!
		const page = this.pageMap[pageId]!
		const cloned = page.cloneSelf(this.pageMap, pageId)!
		cloned.values[childIdx] = value
	}
	addItem(key: K, value: V): void {
		// update value
		const pos = this.pageId.length - 1
		const pageId = this.pageId[pos]!
		const childIdx = this.childIdx[pos]!
		const page = this.pageMap[pageId]!
		const cloned = page.cloneSelf(this.pageMap, pageId)!
		cloned.keys.splice(childIdx, 0, key)
		cloned.values.splice(childIdx, 0, value)

		// copy pages
		let prev = cloned
		let prevId = pageId
		for (let i = this.pageId.length - 2; i >= 0; i--) {
			if (prev.keys.length <= prev.maxKeys) break
			const pageId = this.pageId[i]!
			const childIdx = this.childIdx[i]!
			const page = this.pageMap[pageId]!
			const cloned = page.cloneSelf(this.pageMap, pageId)!
			const { newKey, leftChild, rightChild } = prev._split()
			cloned.keys.splice(childIdx, 0, newKey)
			this.pageMap[prevId] = leftChild
			this.pageMap[PAGE_ID] = rightChild
			leftChild._fixSibling(this.pageMap, prev.prevPage, prevId, PAGE_ID)
			rightChild._fixSibling(this.pageMap, prevId, PAGE_ID, prev.nextPage)
			cloned.children.splice(childIdx, 1, prevId, PAGE_ID)
			PAGE_ID++
			prev = cloned
			prevId = pageId
		}

		// split if root is full
		const root = this.pageMap[0]!
		if (root.keys.length > root.maxKeys) {
			const { newKey, leftChild, rightChild } = root._split()
			this.pageMap[PAGE_ID] = leftChild
			this.pageMap[PAGE_ID + 1] = rightChild
			leftChild.nextPage = PAGE_ID + 1
			rightChild.prevPage = PAGE_ID
			const newRoot = new Page<K, V>(root.minKeys, root.maxKeys)
			this.pageMap[0] = newRoot
			newRoot.keys.push(newKey)
			newRoot.children.push(PAGE_ID, PAGE_ID + 1)
			PAGE_ID += 2
		}
	}
	deleteItem(): void {
		// update value
		const pos = this.pageId.length - 1
		const pageId = this.pageId[pos]!
		const childIdx = this.childIdx[pos]!
		const page = this.pageMap[pageId]!
		const cloned = page.cloneSelf(this.pageMap, pageId)!
		cloned.keys.splice(childIdx, 1)
		cloned.values.splice(childIdx, 1)

		// copy pages
		let prev = cloned
		for (let i = this.pageId.length - 2; i >= 0; i--) {
			if (prev.keys.length >= prev.minKeys) break
			const pageId = this.pageId[i]!
			const childIdx = this.childIdx[i]!
			const page = this.pageMap[pageId]!
			const cloned = page.cloneSelf(this.pageMap, pageId)!
			cloned._mergeChildren(this.pageMap, childIdx)
			prev = cloned
		}

		// update root if the keys array is empty
		const root = this.pageMap[0]!
		if (root.keys.length === 0 && root.children.length === 1) {
			const childId = root.children[0]!
			const newRoot = this.pageMap[childId]!
			this.pageMap[0] = newRoot
			this.pageMap[childId] = undefined!
			newRoot.prevPage = null
			newRoot.nextPage = null
		}
	}
}
