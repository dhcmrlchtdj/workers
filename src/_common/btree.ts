import { Option, some, none } from "./option.js"

class Entry<K, V> {
	// children[i] <= keys[i]
	keys: K[]
	values: V[] // leaf
	children: Entry<K, V>[] // non-leaf
	constructor() {
		this.keys = []
		this.values = []
		this.children = []
	}
	isLeaf(): boolean {
		return this.children.length === 0
	}
	search(key: K): number {
		return this._binarySearch(key)
	}
	_linearSearch(key: K): number {
		let i = 0
		const len = this.keys.length
		while (i < len) {
			if (key <= this.keys[i]!) {
				return i
			}
			i++
		}
		return i
	}
	_binarySearch(key: K): number {
		let left = 0
		let right = this.keys.length
		while (left < right) {
			const m = (left + right) >>> 1
			if (this.keys[m]! < key) {
				left = m + 1
			} else {
				right = m
			}
		}
		return left
	}
}

export class BTree<K extends string | number, V> {
	private count: number
	private root: Entry<K, V> | undefined
	constructor() {
		this.count = 0
		this.root = undefined
	}
	size() {
		return this.count
	}
	clear() {
		this.count = 0
		this.root = undefined
	}
	get(key: K): Option<V> {
		let node = this.root
		while (node !== undefined) {
			const idx = node.search(key)
			if (node.isLeaf()) {
				if (node.keys[idx] === key) {
					return some(node.values[idx]!)
				} else {
					return none
				}
			} else {
				node = node.children[idx]
			}
		}
		return none
	}
	// set(key: K, value: V): Option<V> {
	//     return None
	// }
	// delete(key: K): Option<V> {
	//     if (this.root === undefined) return None
	//     return None
	// }
}
