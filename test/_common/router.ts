import { WorkerRouter } from "../../src/_common/router"

describe("Router", () => {
    test("static", () => {
        const router = new WorkerRouter()
        const fn0 = async () => new Response("ok")
        const fn1 = async () => new Response("ok")
        const fn2 = async () => new Response("ok")
        const fn3 = async () => new Response("ok")
        router.get("/", fn0)
        router.get("/a", fn1)
        router.get("/a/b", fn2)
        router.get("/a/b/c", fn3)
        expect(router.route(new Request("https://localhost/")).handler).toBe(
            fn0,
        )
        expect(router.route(new Request("https://localhost/a")).handler).toBe(
            fn1,
        )
        expect(router.route(new Request("https://localhost/a/b")).handler).toBe(
            fn2,
        )
        expect(
            router.route(new Request("https://localhost/a/b/c")).handler,
        ).toBe(fn3)
    })
    test("match all", () => {
        const router = new WorkerRouter()
        const fn = async () => new Response("ok")
        router.get("/*", fn)
        router.get("/a/b/*", fn)
        expect(
            router.route(new Request("https://localhost/")),
        ).toMatchSnapshot()
        expect(
            router.route(new Request("https://localhost/a")),
        ).toMatchSnapshot()
        expect(
            router.route(new Request("https://localhost/a/b")),
        ).toMatchSnapshot()
        expect(
            router.route(new Request("https://localhost/a/b/c")),
        ).toMatchSnapshot()
    })
    test("params", () => {
        const router = new WorkerRouter()
        const fn = async () => new Response("ok")
        router.get("/:p", fn)
        router.get("/:p1/:p2", fn)
        expect(
            router.route(new Request("https://localhost/")),
        ).toMatchSnapshot()
        expect(
            router.route(new Request("https://localhost/a")),
        ).toMatchSnapshot()
        expect(
            router.route(new Request("https://localhost/a/b")),
        ).toMatchSnapshot()
        expect(
            router.route(new Request("https://localhost/a/b/c")),
        ).toMatchSnapshot()
    })
    test("error", () => {
        const router = new WorkerRouter()
        const fn = async () => new Response("ok")
        expect(() => router.get("/*/b", fn)).toThrowErrorMatchingSnapshot()
    });
})
