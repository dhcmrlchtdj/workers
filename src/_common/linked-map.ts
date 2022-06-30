import { Option, Some, None } from "./option.js"

export class LinkedMap<K, V> {
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
        node.insert(this.listHead, this.listHead.next!)
        this.map.set(key, node)
    }

    getBack(): V {
        if (this.map.size === 0) throw new Error("getBack")
        const node = this.listTail.prev!
        return node.value
    }
    popBack(): Option<V> {
        if (this.map.size === 0) return None
        const node = this.listTail.prev!
        this._del(node)
        return Some(node.value)
    }
    pushBack(key: K, value: V) {
        const node = new Node(key, value)
        node.insert(this.listTail.prev!, this.listTail)
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
    insert(prev: Node<K, V>, next: Node<K, V>) {
        this.prev = prev
        prev.next = this
        this.next = next
        next.prev = this
    }
}
