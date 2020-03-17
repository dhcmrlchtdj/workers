// https://docs.rollbar.com/docs/webhooks
// https://rollbar.com/h11/feedbox/items/23/occurrences/117235378113/
// https://transform.tools/json-to-typescript

export type Occurrence = {
    url: string
    occurrence: {
        feedurl: string
        body?: {
            message?: {
                body?: string
            }
            trace_chain?: Array<{
                exception?: {
                    message?: string
                }
            }>
        }
    }
}

export type RollbarPayload = {
    event_name: 'occurrence'
    data: Occurrence
}
