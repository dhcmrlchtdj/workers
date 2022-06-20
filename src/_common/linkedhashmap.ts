import { None, Option, Some } from "./option.js"

export class LinkedHashMap<K, V> {
    private map: Map<K, LinkedListNode<K, V>>
    private list: LinkedList<K, V>
    constructor() {
        this.map = new Map()
        this.list = new LinkedList()
    }
    get length(): number {
        return this.map.size
    }

    removeByKey(key: K) {
        const node = this.map.get(key)
        if (!node) return
        this.map.delete(key)
        node.pop()
    }
    removeIf(fn: (key: K, value: V) => boolean) {
        for (const node of this.map.values()) {
            if (fn(node.key, node.value)) {
                this.map.delete(node.key)
                node.pop()
            }
        }
    }

    getFront(): V {
        if (this.length === 0) throw new Error("getFront")
        return this.list.getFront()
    }
    popFront(): Option<V> {
        if (this.length === 0) return None
        const node = this.list.popFront()
        this.map.delete(node.key)
        return Some(node.value)
    }
    pushFront(key: K, value: V) {
        const node = this.list.pushFront(key, value)
        this.map.set(key, node)
    }

    getBack(): V {
        if (this.length === 0) throw new Error("getBack")
        return this.list.getBack()
    }
    popBack(): Option<V> {
        if (this.length === 0) return None
        const node = this.list.popBack()
        this.map.delete(node.key)
        return Some(node.value)
    }
    pushBack(key: K, value: V) {
        const node = this.list.pushBack(key, value)
        this.map.set(key, node)
    }
}

class LinkedList<K, V> {
    head: LinkedListNode<K, V>
    tail: LinkedListNode<K, V>
    constructor() {
        // @ts-expect-error
        this.head = new LinkedListNode(null, null)
        // @ts-expect-error
        this.tail = new LinkedListNode(null, null)
        this.head.next = this.tail
        this.tail.prev = this.head
    }

    getFront(): V {
        return this.head.next!.value
    }
    popFront(): LinkedListNode<K, V> {
        const node = this.head.next!
        node.pop()
        return node
    }
    pushFront(key: K, value: V): LinkedListNode<K, V> {
        const node = new LinkedListNode(key, value)
        node.insertAfter(this.head)
        return node
    }
    getBack(): V {
        return this.tail.prev!.value
    }
    popBack(): LinkedListNode<K, V> {
        const node = this.tail.prev!
        node.pop()
        return node
    }
    pushBack(key: K, value: V): LinkedListNode<K, V> {
        const node = new LinkedListNode(key, value)
        node.insertBefore(this.tail)
        return node
    }
}

class LinkedListNode<K, V> {
    prev: null | LinkedListNode<K, V>
    next: null | LinkedListNode<K, V>
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
    insertAfter(prev: LinkedListNode<K, V>) {
        const next = prev.next!
        this.prev = prev
        prev.next = this
        this.next = next
        next.prev = this
    }
    insertBefore(next: LinkedListNode<K, V>) {
        const prev = next.prev!
        this.prev = prev
        prev.next = this
        this.next = next
        next.prev = this
    }
}
