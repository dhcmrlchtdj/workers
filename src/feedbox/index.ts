const worker: ExportedHandler = {
    fetch(request, _env, _ctx) {
        const host = "fbox.herokuapp.com"
        const url = new URL(request.url)
        url.host = host
        const req = new Request(url.toString(), {
            method: request.method,
            headers: request.headers,
            body: request.body,
            redirect: "manual",
        })
        req.headers.set("host", host)
        return fetch(req)
    },
}

export default worker
