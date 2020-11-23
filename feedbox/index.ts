export {}

addEventListener('fetch', (event) => {
    event.respondWith(handle(event))
})

async function handle(event: FetchEvent) {
    const host = 'fbox.herokuapp.com'
    const request = event.request
    const url = new URL(request.url)
    url.host = host
    const req = new Request(url.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'manual',
    })
    req.headers.set('host', host)
    return fetch(req)
}
