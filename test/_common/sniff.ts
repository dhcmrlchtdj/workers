import * as fs from "node:fs/promises"
import * as url from "node:url"
import * as path from "node:path"
import * as S from "../../src/_common/http/sniff.js"

const resolveFile = (p: string) =>
	path.relative(process.cwd(), url.fileURLToPath(new URL(p, import.meta.url)))

describe("MIME Sniff", () => {
	test("test", async () => {
		const patterns = [
			...S.htmlPatterns,
			...S.documentPatterns,
			...S.imagePatterns,
			...S.audioVideoPatterns,
			...S.fontPatterns,
			...S.archivePatterns,
			S.plaintextPattern,
		]

		const cases = [
			{
				file: "./__fixtures__/flac.flac",
				mime: "application/octet-stream",
			},
			{
				file: "./__fixtures__/mp3-raw.mp3",
				mime: "application/octet-stream",
			},
			{ file: "./__fixtures__/mp3-with-id3.mp3", mime: "audio/mpeg" },
			{ file: "./__fixtures__/mp4.mp4", mime: "video/mp4" },
			{ file: "./__fixtures__/ogg.ogg", mime: "application/ogg" },
			{ file: "./__fixtures__/wav.wav", mime: "audio/wave" },
			{ file: "./__fixtures__/webm.webm", mime: "video/webm" },
		]
		const r = cases.map(async (c) => {
			const data = await fs.readFile(resolveFile(c.file))
			const mime = S.detectContentType(data, patterns)
			expect(mime).toBe(c.mime)
		})

		await Promise.all(r)
	})
})
