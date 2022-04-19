export class Deferred<T = void> {
    promise: Promise<T>
    isFulfilled: boolean
    isResolved: boolean
    isRejected: boolean
    // @ts-ignore
    resolve: (payload: T) => void
    // @ts-ignore
    reject: (err?: Error) => void
    constructor() {
        this.isFulfilled = false
        this.isResolved = false
        this.isRejected = false
        this.promise = new Promise((resolve, reject) => {
            this.resolve = (payload: T) => {
                this.isFulfilled = true
                this.isResolved = true
                resolve(payload)
            }
            this.reject = (err?: Error) => {
                this.isFulfilled = true
                this.isRejected = true
                reject(err)
            }
        })
    }
}
