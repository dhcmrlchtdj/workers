import { Option, some, none } from "./option.js"

// https://ticki.github.io/blog/skip-lists-done-right/
// https://graphics.stanford.edu/~seander/bithacks.html
const SKIPLIST_MAXLEVEL = 16
// const SKIPLIST_P = 0.5
function randomLevel(): number {
	let level = 1
	let x = Math.floor(Math.random() * 0xffff) // [0x0, 0xffff)
	while ((x & 0x1) === 1) {
		x >>= 1
		level++
	}
	return level
}

class SkipNode<K, V> {
	key: K
	value: V
	prev: SkipNode<K, V> | undefined
	next: (SkipNode<K, V> | undefined)[]
	constructor(level: number, key: K, value: V) {
		this.key = key
		this.value = value
		this.prev = undefined
		this.next = new Array<SkipNode<K, V> | undefined>(level)
	}
}

export class SkipList<K extends string | number, V> {
	private level: number
	private head: SkipNode<K, V>

	constructor() {
		this.level = 1
		this.head = new SkipNode<K, V>(
			SKIPLIST_MAXLEVEL,
			undefined!,
			undefined!,
		)
	}

	search(key: K): Option<V> {
		let curr: SkipNode<K, V> = this.head
		for (let i = this.level - 1; i >= 0; i--) {
			while (curr.next[i] && curr.next[i]!.key < key) {
				curr = curr.next[i]!
			}
		}

		// when the loop ended, curr.item < item <= curr.next[0].item
		// so we move to curr.next[0]
		const node = curr.next[0]
		if (node && node.key === key) {
			return some(node.value)
		} else {
			return none
		}
	}

	insert(key: K, value: V): Option<V> {
		const update = new Array<SkipNode<K, V>>(this.level)

		let curr: SkipNode<K, V> = this.head
		for (let i = this.level - 1; i >= 0; i--) {
			while (curr.next[i] && curr.next[i]!.key < key) {
				curr = curr.next[i]!
			}
			update[i] = curr
		}

		const node = curr.next[0]
		if (node && node.key === key) {
			const replaced = node.value
			node.value = value
			return some(replaced)
		} else {
			const newLevel = randomLevel()

			if (newLevel > this.level) {
				for (let i = this.level; i < newLevel; i++) {
					update[i] = this.head
				}
				this.level = newLevel
			}

			const newNode = new SkipNode(newLevel, key, value)
			for (let i = 0; i < newLevel; i++) {
				newNode.next[i] = update[i]!.next[i]
				update[i]!.next[i] = newNode
			}
			newNode.prev = update[0]
			if (newNode.next[0]) newNode.next[0].prev = newNode

			return none
		}
	}

	delete(key: K): Option<V> {
		const update = new Array<SkipNode<K, V>>(this.level)

		let curr: SkipNode<K, V> = this.head
		for (let i = this.level - 1; i >= 0; i--) {
			while (curr.next[i] && curr.next[i]!.key < key) {
				curr = curr.next[i]!
			}
			update[i] = curr
		}

		const node = curr.next[0]
		if (node && node.key === key) {
			for (let i = 0; i < update.length; i++) {
				if (update[i]!.next[i] === node) {
					update[i]!.next[i] = node.next[i]
				} else {
					break
				}
			}
			if (node.next[0]) node.next[0].prev = node.prev
			while (
				this.level > 1 &&
				this.head.next[this.level - 1] === undefined
			) {
				this.level--
			}
			return some(node.value)
		} else {
			return none
		}
	}
}
