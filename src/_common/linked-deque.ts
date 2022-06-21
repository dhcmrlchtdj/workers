import { Option, Some, None } from "./option.js"

export class LinkedDeque<K, V> {
    private map: Map<K, Node<K, V>>
    private listHead: Node<K, V>
    private listTail: Node<K, V>
    constructor() {
        this.map = new Map()
        // @ts-expect-error
        this.listHead = new Node(null, null)
        // @ts-expect-error
        this.listTail = new Node(null, null)
        this.listHead.next = this.listTail
        this.listTail.prev = this.listHead
    }
    get length(): number {
        return this.map.size
    }

    private _del(node: Node<K, V>) {
        node.pop()
        this.map.delete(node.key)
    }

    removeByKey(key: K) {
        const node = this.map.get(key)
        if (!node) return
        this._del(node)
    }
    removeIf(fn: (key: K, value: V) => boolean) {
        for (const node of this.map.values()) {
            if (fn(node.key, node.value)) {
                this._del(node)
            }
        }
    }

    getFront(): V {
        if (this.map.size === 0) throw new Error("getFront")
        const node = this.listHead.next!
        return node.value
    }
    popFront(): Option<V> {
        if (this.map.size === 0) return None
        const node = this.listHead.next!
        this._del(node)
        return Some(node.value)
    }
    pushFront(key: K, value: V) {
        const node = new Node(key, value)
        node.insertAfter(this.listHead)
        this.map.set(key, node)
    }

    getBack(): V {
        if (this.map.size === 0) throw new Error("getBack")
        const node = this.listTail.prev!
        return node.value
    }
    popBack(): Option<V> {
        if (this.length === 0) return None
        const node = this.listTail.prev!
        this._del(node)
        return Some(node.value)
    }
    pushBack(key: K, value: V) {
        const node = new Node(key, value)
        node.insertBefore(this.listTail)
        this.map.set(key, node)
    }
}

class Node<K, V> {
    prev: null | Node<K, V>
    next: null | Node<K, V>
    key: K
    value: V
    constructor(key: K, value: V) {
        this.prev = null
        this.next = null
        this.key = key
        this.value = value
    }
    pop() {
        const prev = this.prev!
        const next = this.next!
        prev.next = next
        next.prev = prev
    }
    insertAfter(prev: Node<K, V>) {
        const next = prev.next!
        this.prev = prev
        prev.next = this
        this.next = next
        next.prev = this
    }
    insertBefore(next: Node<K, V>) {
        const prev = next.prev!
        this.prev = prev
        prev.next = this
        this.next = next
        next.prev = this
    }
}
