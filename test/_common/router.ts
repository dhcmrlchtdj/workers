import * as W from "../../src/_common/worker/index.js"
import * as S from "../../src/_common/http/request.js"
import * as R from "../../src/_common/http/response.js"

describe("Worker Router", () => {
	test("all", async () => {
		const r = new W.Router()
		r.get("/a/*", ({ param }) => R.build(R.json({ r: 1, p: [...param] })))
		r.get("/*", ({ param }) => R.build(R.json({ r: 2, p: [...param] })))
		r.get("*", ({ param }) => R.build(R.json({ r: 3, p: [...param] })))

		const testcase = ["/", "/a", "/a/", "/a/b", "/a/b/c", "/b"]
		const test = testcase.map(async (c) => {
			// @ts-expect-error
			const resp = await r.handle(
				S.build(S.get("https://example.com" + c)),
			)
			const text = await resp.text()
			expect({ in: c, out: text }).toMatchSnapshot()
		})
		await Promise.all(test)
	})

	test("param", async () => {
		const r = new W.Router()
		r.get("/:p", ({ param }) => R.build(R.json({ r: 1, p: [...param] })))
		r.get("/a/:p2", ({ param }) => R.build(R.json({ r: 2, p: [...param] })))
		r.get("/:p1/b", ({ param }) => R.build(R.json({ r: 3, p: [...param] })))
		r.get("/:p1/:p2", ({ param }) =>
			R.build(R.json({ r: 4, p: [...param] })),
		)

		const testcase = [
			"/",
			"/a",
			"/a/",
			"/a/b",
			"/a/b/c",
			"/x/b",
			"/a/y",
			"/x/y",
		]
		const test = testcase.map(async (c) => {
			// @ts-expect-error
			const resp = await r.handle(
				S.build(S.get("https://example.com" + c)),
			)
			const text = await resp.text()
			expect({ in: c, out: text }).toMatchSnapshot()
		})
		await Promise.all(test)
	})

	test("static", async () => {
		const r = new W.Router()
		r.get("/", () => R.build(R.json({ r: 1 })))
		r.get("/a", () => R.build(R.json({ r: 2 })))
		r.get("/a/", () => R.build(R.json({ r: 3 })))
		r.get("/a/b", () => R.build(R.json({ r: 4 })))

		const testcase = ["/", "/a", "/a/", "/a/b", "/a/b/", "/a/b/c", "/b"]
		const test = testcase.map(async (c) => {
			// @ts-expect-error
			const resp = await r.handle(
				S.build(S.get("https://example.com" + c)),
			)
			const text = await resp.text()
			expect({ in: c, out: text }).toMatchSnapshot()
		})
		await Promise.all(test)
	})
})
