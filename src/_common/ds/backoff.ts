// https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/

// Usage:
// const b = new Backoff(500, 5000)
// await b.sleep()

export class Backoff {
	private attempts: number
	private minDealy: number // millisecond
	private maxDelay: number // millisecond

	constructor(minDealyInMS: number, maxDelayInMS: number) {
		this.attempts = 0
		this.minDealy = minDealyInMS
		this.maxDelay = maxDelayInMS
	}

	async sleep() {
		// full jitter
		const tmp =
			Math.min(this.minDealy * 2 ** this.attempts, this.maxDelay) / 2
		const delay = tmp * Math.random() + tmp
		this.attempts++
		await new Promise((r) => setTimeout(r, delay))
	}
}
