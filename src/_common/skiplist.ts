// const SKIPLIST_MAXLEVEL = 32
// const SKIPLIST_P = 0.25
// function randomLevel(): number {
//     let level = 1
//     while (Math.random() < SKIPLIST_P) {
//         level++
//     }
//     return Math.min(SKIPLIST_MAXLEVEL, level)
// }

const SKIPLIST_MAXLEVEL = 16
// const SKIPLIST_P = 0.5
function randomLevel(): number {
	// https://ticki.github.io/blog/skip-lists-done-right/
	// https://graphics.stanford.edu/~seander/bithacks.html
	let level = 1
	let x = Math.floor(Math.random() * 0xffff) // [0x0, 0xffff)
	while ((x & 0x1) === 1) {
		x >>= 1
		level++
	}
	return level
}

// eslint-disable-next-line
export interface SkipItem {
	lt(x: SkipItem): boolean
	eq(x: SkipItem): boolean
}

class SkipNode<I extends SkipItem> {
	item: I | undefined
	forward: (SkipNode<I> | undefined)[]
	constructor(level: number, item: I | undefined) {
		this.item = item
		this.forward = new Array<SkipNode<I> | undefined>(level)
	}
	lt(item: I | undefined): boolean {
		if (item === undefined || this.item === undefined) return false
		return this.item.lt(item)
	}
	eq(item: I | undefined): boolean {
		if (item === undefined || this.item === undefined) return false
		return this.item.eq(item)
	}
}

export class SkipList<I extends SkipItem> {
	level: number
	header: SkipNode<I>

	constructor() {
		this.level = 1
		this.header = new SkipNode<I>(SKIPLIST_MAXLEVEL, undefined)
	}

	search(item: I): I | undefined {
		let curr: SkipNode<I> = this.header
		for (let i = this.level - 1; i >= 0; i--) {
			while (curr.forward[i]?.lt(item)) {
				curr = curr.forward[i]!
			}
		}

		// when the loop ended, curr.item < item <= curr.forward[0].item
		// so we move to curr.forward[0]
		const node = curr.forward[0]
		if (node?.eq(item)) {
			return node.item
		} else {
			return undefined
		}
	}

	/// true: new item inserted
	/// false: old item replaced
	insert(item: I): boolean {
		const update = new Array<SkipNode<I>>(this.level)

		let curr: SkipNode<I> = this.header
		for (let i = this.level - 1; i >= 0; i--) {
			while (curr.forward[i]?.lt(item)) {
				curr = curr.forward[i]!
			}
			update[i] = curr
		}

		const node = curr.forward[0]
		if (node?.eq(item)) {
			node.item = item
			return false
		} else {
			const newLevel = randomLevel()

			if (newLevel > this.level) {
				for (let i = this.level; i < newLevel; i++) {
					update[i] = this.header
				}
				this.level = newLevel
			}

			const newNode = new SkipNode(newLevel, item)
			for (let i = 0; i < newLevel; i++) {
				newNode.forward[i] = update[i]!.forward[i]
				update[i]!.forward[i] = newNode
			}

			return true
		}
	}

	/// true: deleted old item
	/// false: not found
	delete(item: I): boolean {
		const update = new Array<SkipNode<I>>(this.level)

		let curr: SkipNode<I> = this.header
		for (let i = this.level - 1; i >= 0; i--) {
			while (curr.forward[i]?.lt(item)) {
				curr = curr.forward[i]!
			}
			update[i] = curr
		}

		const node = curr.forward[0]
		if (node?.eq(item)) {
			for (let i = 0; i < update.length; i++) {
				if (update[i]!.forward[i] === node) {
					update[i]!.forward[i] = node.forward[i]!
				} else {
					break
				}
			}
			while (
				this.level > 1 &&
				this.header.forward[this.level] === undefined
			) {
				this.level--
			}
			return true
		} else {
			return false
		}
	}
}
