import { describe, expect, test } from "@jest/globals"
import * as W from "."
import * as S from "../http/request.ts"
import * as R from "../http/response.ts"

describe("Worker Router", () => {
	test("all", async () => {
		const r = new W.Router()
		r.get("/a/*", ({ param }) => R.build(R.json({ r: 1, p: [...param] })))
		r.get("/*", ({ param }) => R.build(R.json({ r: 2, p: [...param] })))
		r.get("*", ({ param }) => R.build(R.json({ r: 3, p: [...param] })))

		await Promise.all([
			t(r, "/"),
			t(r, "/a"),
			t(r, "/a/"),
			t(r, "/a/b"),
			t(r, "/a/b/c"),
			t(r, "/b"),
		])
	})

	test("param", async () => {
		const r = new W.Router()
		r.get("/:p", ({ param }) => R.build(R.json({ r: 1, p: [...param] })))
		r.get("/a/:p2", ({ param }) => R.build(R.json({ r: 2, p: [...param] })))
		r.get("/:p1/b", ({ param }) => R.build(R.json({ r: 3, p: [...param] })))
		r.get("/:p1/:p2", ({ param }) =>
			R.build(R.json({ r: 4, p: [...param] })),
		)

		await Promise.all([
			t(r, "/"),
			t(r, "/a"),
			t(r, "/a/"),
			t(r, "/a/b"),
			t(r, "/a/b/c"),
			t(r, "/x/b"),
			t(r, "/a/y"),
			t(r, "/x/y"),
		])
	})

	test("static", async () => {
		const r = new W.Router()
		r.get("/", () => R.build(R.json({ r: 1 })))
		r.get("/a", () => R.build(R.json({ r: 2 })))
		r.get("/a/", () => R.build(R.json({ r: 3 })))
		r.get("/a/b", () => R.build(R.json({ r: 4 })))

		await Promise.all([
			t(r, "/"),
			t(r, "/a"),
			t(r, "/a/"),
			t(r, "/a/b"),
			t(r, "/a/b/"),
			t(r, "/a/b/c"),
			t(r, "/b"),
		])
	})
})

async function t(router: W.Router<unknown>, path: string) {
	const resp = await router.handle(
		S.build(S.get("https://example.com" + path)),
		{},
		{} as ExecutionContext,
	)
	const text = await resp.text()
	expect({ in: path, out: text }).toMatchSnapshot()
}
