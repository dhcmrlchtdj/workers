import { describe, expect, test } from "@jest/globals"
import * as fs from "node:fs/promises"
import * as url from "node:url"
import * as path from "node:path"
import * as S from "../../src/_common/http/sniff.ts"

const resolveFile = (p: string) =>
	path.relative(process.cwd(), url.fileURLToPath(new URL(p, import.meta.url)))

describe("MIME Sniff", () => {
	test("test", async () => {
		await Promise.all([
			t("./__fixtures__/flac.flac", "audio/flac"),
			t("./__fixtures__/mp3-raw.mp3", "application/octet-stream"),
			t("./__fixtures__/mp3-with-id3.mp3", "audio/mpeg"),
			t("./__fixtures__/mp4.mp4", "video/mp4"),
			t("./__fixtures__/ogg.ogg", "application/ogg"),
			t("./__fixtures__/wav.wav", "audio/wave"),
			t("./__fixtures__/webm.webm", "video/webm"),
		])

		async function t(file: string, mime: string) {
			const data = await fs.readFile(resolveFile(file))
			const actual = S.detectContentType(data)
			expect(actual).toBe(mime)
		}
	})
})
