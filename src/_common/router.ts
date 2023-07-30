import { assert } from "./assert.js"

class Node<T> {
	matched: T | null
	static: Map<string, Node<T>>
	parameter: Map<string, Node<T>>
	wildcard: T | null
	constructor() {
		this.matched = null
		this.static = new Map()
		this.parameter = new Map()
		this.wildcard = null
	}
}

export class Tree<T> {
	private _root: Node<T>
	constructor() {
		this._root = new Node()
	}
	set(segments: string[], value: T): void {
		let node = this._root
		for (let i = 0, len = segments.length; i < len; i++) {
			const seg = segments[i]!
			if (seg === "*") {
				assert(len === i + 1, '"*" must be the last segment')
				node.wildcard = value
				return
			} else if (seg[0] === ":") {
				const param = seg.slice(1)
				let r = node.parameter.get(param)
				if (r === undefined) {
					r = new Node()
					node.parameter.set(param, r)
				}
				node = r
			} else {
				let r = node.static.get(seg)
				if (r === undefined) {
					r = new Node()
					node.static.set(seg, r)
				}
				node = r
			}
		}
		assert(node.matched === null, "duplicated node")
		node.matched = value
	}
	get(segments: string[]) {
		return this._get(segments, 0, new Map(), this._root)
	}
	private _get(
		segments: string[],
		idx: number,
		param: Map<string, string>,
		node: Node<T>,
	): { matched: T; param: Map<string, string> } | null {
		if (idx === segments.length) {
			if (node.matched !== null) {
				return { matched: node.matched, param }
			}
		} else {
			const seg = segments[idx]!

			const staticNode = node.static.get(seg)
			if (staticNode !== undefined) {
				const found = this._get(segments, idx + 1, param, staticNode)
				if (found !== null) return found
			}

			if (seg !== "") {
				for (const [paramName, paramNode] of node.parameter) {
					const found = this._get(segments, idx + 1, param, paramNode)
					if (found) {
						found.param.set(paramName, seg)
						return found
					}
				}
			}

			if (node.wildcard !== null) {
				param.set("*", segments.slice(idx).join("/"))
				return { matched: node.wildcard, param }
			}
		}
		return null
	}
}
