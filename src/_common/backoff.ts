// https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/

// Usage:
// const b = new Backoff(1000 * 5, 500)
// await b.sleep()

export class Backoff {
    private attempt: number
    private maxDelay: number // millisecond
    private initialValue: number // millisecond

    constructor(maxDelay: number, initialValue: number) {
        this.attempt = 0
        this.maxDelay = maxDelay
        this.initialValue = initialValue
    }

    async sleep() {
        // full jitter
        const delay =
            Math.min(this.maxDelay, this.initialValue * 2 ** this.attempt) *
            Math.random()
        this.attempt++
        await new Promise((r) => setTimeout(r, delay))
    }
}
