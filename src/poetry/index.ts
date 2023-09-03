import * as W from "../_common/worker/index.ts"
import * as R from "../_common/http/response.ts"
import { HttpNotFound } from "../_common/http/status.ts"

type ENV = {
	BA: KVNamespace
}

///

const router = new W.Router<ENV>()
router.use("*", W.serverTiming())
router.head("*", W.serveHeadWithGet())
router.get("/", W.cacheResponse(), async ({ env }) => {
	const poem = await randomPick(env.BA)
	return R.build(
		R.text(poem),
		R.cacheControl("public, must-revalidate, max-age=20"),
		R.header("ww-poetry-source", "github.com/chinese-poetry#66fc88c"),
	)
})
router.get("/favicon.ico", W.cacheResponse(), () => {
	const favicon =
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><circle cx="1" cy="1" r="1" fill="hsl(50,100%,75%)"/></svg>'
	return R.build(
		R.svg(favicon),
		R.header("etag", '"circle-fill-hsl-50-100-75"'),
		R.cacheControl(
			"public, must-revalidate, s-maxage=86400, max-age=604800",
		),
	)
})

function randomPick(kv: KVNamespace): Promise<string> {
	const arr = [pickShijing(), pickChuci(), pickSong300()]
	const chosen = arr[Math.floor(arr.length * Math.random())]!
	return chosen(kv)
}
function pick<T>(key: string, format: (poem: T) => string) {
	return async (kv: KVNamespace) => {
		const end = W.addServerTiming("kv")
		const poetry = await kv.get<T[]>(key, {
			type: "json",
			cacheTtl: 86400, // 1d
		})
		end()
		if (!poetry) throw HttpNotFound()
		const poem = poetry[Math.floor(poetry.length * Math.random())]!
		return format(poem)
	}
}
function pickShijing() {
	return pick(
		"poetry:shijing",
		(poem: {
			chapter: string
			section: string
			title: string
			content: string[]
		}) => {
			const text = [
				poem.chapter + "\u2027" + poem.section + "\u2027" + poem.title,
				"",
				...poem.content,
			].join("\n")
			return text
		},
	)
}
function pickChuci() {
	return pick(
		"poetry:chuci",
		(poem: {
			section: string
			title: string
			author: string
			content: string[]
		}) => {
			const offset =
				Math.floor((poem.content.length / 2 - 2) * Math.random()) * 2
			const text = [
				poem.section === poem.title
					? poem.section
					: poem.section + "\u2027" + poem.title,
				poem.author,
				"",
				...poem.content.slice(offset, offset + 4),
			].join("\n")
			return text
		},
	)
}
function pickSong300() {
	return pick(
		"poetry:song300",
		(poem: { author: string; paragraphs: string[]; rhythmic: string }) => {
			const text = [
				poem.rhythmic,
				poem.author,
				"",
				...poem.paragraphs,
			].join("\n")
			return text
		},
	)
}

///

const exportedHandler: ExportedHandler<ENV> = {
	fetch: (req, env, ec) => router.handle(req, env, ec),
}
export default exportedHandler
