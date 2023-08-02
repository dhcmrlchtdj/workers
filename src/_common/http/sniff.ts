import { MIME_OCTET } from "./mime.js"

// https://mimesniff.spec.whatwg.org/
// Last Updated 17 July 2023
//
// https://github.com/golang/go/blob/go1.20.7/src/net/http/sniff.go#L21

///

type Matcher = (data: Uint8Array) => boolean

function createMatcherExact(pattern: number[]): Matcher {
	return (data) => {
		const patternLen = pattern.length
		if (data.length < patternLen) return false
		for (let i = 0; i < patternLen; i++) {
			if (data[i] !== pattern[i]) return false
		}
		return true
	}
}

function createMatcherMasked(pattern: number[], mask: number[]): Matcher {
	return (data) => {
		const patternLen = pattern.length
		if (data.length < patternLen) return false
		for (let i = 0; i < patternLen; i++) {
			const masked = data[i]! & mask[i]!
			if (masked !== pattern[i]) return false
		}
		return true
	}
}

function createMatcherHtml(pattern: number[], mask: number[]): Matcher {
	return (data) => {
		const patternLen = pattern.length
		if (data.length < patternLen + 1) return false
		for (let i = 0; i < patternLen; i++) {
			const masked = data[i]! & mask[i]!
			if (masked !== pattern[i]) return false
		}
		return isTT(data[patternLen]!)
	}
}

function skipWS(m: Matcher): (firstNonWS: number) => Matcher {
	return (firstNonWS) => (data) => m(data.slice(firstNonWS))
}

function isTT(c: number): boolean {
	return c === 0x20 || c === 0x3e
}

function isWS(c: number): boolean {
	return c === 0x09 || c === 0x0a || c === 0x0c || c === 0x0d || c === 0x20
}

///

type Pattern = { init: (firstNonWS: number) => Matcher; mime: string }

export const htmlPatterns: Pattern[] = [
	{
		init: (firstNonWS) =>
			skipWS(
				createMatcherHtml(
					[
						0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54, 0x59, 0x50, 0x45,
						0x20, 0x48, 0x54, 0x4d, 0x4c,
					],
					[
						0xff, 0xff, 0xdf, 0xdf, 0xdf, 0xdf, 0xdf, 0xdf, 0xdf,
						0xff, 0xdf, 0xdf, 0xdf, 0xdf,
					],
				),
			)(firstNonWS),
		mime: "text/html; charset=utf-8",
	},
	{
		init: (firstNonWS) =>
			skipWS(
				createMatcherHtml(
					[0x3c, 0x48, 0x54, 0x4d, 0x4c],
					[0xff, 0xdf, 0xdf, 0xdf, 0xdf],
				),
			)(firstNonWS),
		mime: "text/html; charset=utf-8",
	},
	{
		init: (firstNonWS) =>
			skipWS(
				createMatcherHtml(
					[0x3c, 0x48, 0x45, 0x41, 0x44],
					[0xff, 0xdf, 0xdf, 0xdf, 0xdf],
				),
			)(firstNonWS),
		mime: "text/html; charset=utf-8",
	},
	{
		init: (firstNonWS) =>
			skipWS(
				createMatcherHtml(
					[0x3c, 0x53, 0x43, 0x52, 0x49, 0x50, 0x54],
					[0xff, 0xdf, 0xdf, 0xdf, 0xdf, 0xdf, 0xdf],
				),
			)(firstNonWS),
		mime: "text/html; charset=utf-8",
	},
	{
		init: (firstNonWS) =>
			skipWS(
				createMatcherHtml(
					[0x3c, 0x49, 0x46, 0x52, 0x41, 0x4d, 0x45],
					[0xff, 0xdf, 0xdf, 0xdf, 0xdf, 0xdf, 0xdf],
				),
			)(firstNonWS),
		mime: "text/html; charset=utf-8",
	},
	{
		init: (firstNonWS) =>
			skipWS(createMatcherHtml([0x3c, 0x48, 0x31], [0xff, 0xdf, 0xff]))(
				firstNonWS,
			),
		mime: "text/html; charset=utf-8",
	},
	{
		init: (firstNonWS) =>
			skipWS(
				createMatcherHtml(
					[0x3c, 0x44, 0x49, 0x56],
					[0xff, 0xdf, 0xdf, 0xdf],
				),
			)(firstNonWS),
		mime: "text/html; charset=utf-8",
	},
	{
		init: (firstNonWS) =>
			skipWS(
				createMatcherHtml(
					[0x3c, 0x46, 0x4f, 0x4e, 0x54],
					[0xff, 0xdf, 0xdf, 0xdf, 0xdf],
				),
			)(firstNonWS),
		mime: "text/html; charset=utf-8",
	},
	{
		init: (firstNonWS) =>
			skipWS(
				createMatcherHtml(
					[0x3c, 0x54, 0x41, 0x42, 0x4c, 0x45],
					[0xff, 0xdf, 0xdf, 0xdf, 0xdf, 0xdf],
				),
			)(firstNonWS),
		mime: "text/html; charset=utf-8",
	},
	{
		init: (firstNonWS) =>
			skipWS(createMatcherHtml([0x3c, 0x41], [0xff, 0xdf]))(firstNonWS),
		mime: "text/html; charset=utf-8",
	},
	{
		init: (firstNonWS) =>
			skipWS(
				createMatcherHtml(
					[0x3c, 0x53, 0x54, 0x59, 0x4c, 0x45],
					[0xff, 0xdf, 0xdf, 0xdf, 0xdf, 0xdf],
				),
			)(firstNonWS),
		mime: "text/html; charset=utf-8",
	},
	{
		init: (firstNonWS) =>
			skipWS(
				createMatcherHtml(
					[0x3c, 0x54, 0x49, 0x54, 0x4c, 0x45],
					[0xff, 0xdf, 0xdf, 0xdf, 0xdf, 0xdf],
				),
			)(firstNonWS),
		mime: "text/html; charset=utf-8",
	},
	{
		init: (firstNonWS) =>
			skipWS(createMatcherHtml([0x3c, 0x42], [0xff, 0xdf]))(firstNonWS),
		mime: "text/html; charset=utf-8",
	},
	{
		init: (firstNonWS) =>
			skipWS(
				createMatcherHtml(
					[0x3c, 0x42, 0x4f, 0x44, 0x59],
					[0xff, 0xdf, 0xdf, 0xdf, 0xdf],
				),
			)(firstNonWS),
		mime: "text/html; charset=utf-8",
	},
	{
		init: (firstNonWS) =>
			skipWS(createMatcherHtml([0x3c, 0x42, 0x52], [0xff, 0xdf, 0xdf]))(
				firstNonWS,
			),
		mime: "text/html; charset=utf-8",
	},
	{
		init: (firstNonWS) =>
			skipWS(createMatcherHtml([0x3c, 0x50], [0xff, 0xdf]))(firstNonWS),
		mime: "text/html; charset=utf-8",
	},
	{
		init: (firstNonWS) =>
			skipWS(
				createMatcherHtml(
					[0x3c, 0x21, 0x2d, 0x2d],
					[0xff, 0xff, 0xff, 0xff],
				),
			)(firstNonWS),
		mime: "text/html; charset=utf-8",
	},
]

export const documentPatterns: Pattern[] = [
	{
		init: (firstNonWS) =>
			skipWS(createMatcherExact([0x3c, 0x3f, 0x78, 0x6d, 0x6c]))(
				firstNonWS,
			),
		mime: "text/xml; charset=utf-8",
	},
	{
		init: () => createMatcherExact([0x25, 0x50, 0x44, 0x46, 0x2d]),
		mime: "application/pdf",
	},
	{
		init: () =>
			createMatcherExact([
				0x25, 0x21, 0x50, 0x53, 0x2d, 0x41, 0x64, 0x6f, 0x62, 0x65,
				0x2d,
			]),
		mime: "application/postscript",
	},
	{
		init: () =>
			createMatcherMasked(
				[0xfe, 0xff, 0x00, 0x00],
				[0xff, 0xff, 0x00, 0x00],
			),
		mime: "text/plain; charset=utf-16be",
	},
	{
		init: () =>
			createMatcherMasked(
				[0xff, 0xfe, 0x00, 0x00],
				[0xff, 0xff, 0x00, 0x00],
			),
		mime: "text/plain; charset=utf-16le",
	},
	{
		init: () =>
			createMatcherMasked(
				[0xef, 0xbb, 0xbf, 0x00],
				[0xff, 0xff, 0xff, 0x00],
			),
		mime: "text/plain; charset=utf-8",
	},
]

// https://mimesniff.spec.whatwg.org/#matching-an-image-type-pattern
export const imagePatterns: Pattern[] = [
	{
		init: () => createMatcherExact([0x00, 0x00, 0x01, 0x00]),
		mime: "image/x-icon",
	},
	{
		init: () => createMatcherExact([0x00, 0x00, 0x02, 0x00]),
		mime: "image/x-icon",
	},
	{
		init: () => createMatcherExact([0x42, 0x4d]),
		mime: "image/bmp",
	},
	{
		init: () => createMatcherExact([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
		mime: "image/gif",
	},
	{
		init: () => createMatcherExact([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]),
		mime: "image/gif",
	},
	{
		init: () =>
			createMatcherMasked(
				[
					0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45,
					0x42, 0x50, 0x56, 0x50,
				],
				[
					0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff,
					0xff, 0xff, 0xff, 0xff,
				],
			),
		mime: "image/webp",
	},
	{
		init: () =>
			createMatcherExact([
				0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
			]),
		mime: "image/png",
	},
	{
		init: () => createMatcherExact([0xff, 0xd8, 0xff]),
		mime: "image/jpeg",
	},
]

// https://mimesniff.spec.whatwg.org/#matching-an-audio-or-video-type-pattern
export const audioVideoPatterns: Pattern[] = [
	{
		init: () =>
			createMatcherMasked(
				[
					0x46, 0x4f, 0x52, 0x4d, 0x00, 0x00, 0x00, 0x00, 0x41, 0x49,
					0x46, 0x46,
				],
				[
					0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff,
					0xff, 0xff,
				],
			),
		mime: "audio/aiff",
	},
	{
		init: () => createMatcherExact([0x49, 0x44, 0x33]),
		mime: "audio/mpeg",
	},
	{
		init: () => createMatcherExact([0x4f, 0x67, 0x67, 0x53, 0x00]),
		mime: "application/ogg",
	},
	{
		init: () =>
			createMatcherExact([
				0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06,
			]),
		mime: "audio/midi",
	},
	{
		init: () =>
			createMatcherMasked(
				[
					0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x41, 0x56,
					0x49, 0x20,
				],
				[
					0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff,
					0xff, 0xff,
				],
			),
		mime: "video/avi",
	},
	{
		init: () =>
			createMatcherMasked(
				[
					0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41,
					0x56, 0x45,
				],
				[
					0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff,
					0xff, 0xff,
				],
			),
		mime: "audio/wave",
	},
	// MP4
	// https://mimesniff.spec.whatwg.org/#signature-for-mp4
	{
		init: () => (data: Uint8Array) => {
			const sequence = new DataView(data.buffer)
			const length = sequence.byteLength
			if (length < 12) return false
			const boxSize = sequence.getUint32(0, false)
			if (length < boxSize || boxSize % 4 !== 0) return false
			if (sequence.getUint32(4, false) !== 0x66747970) return false
			if ((sequence.getUint32(8, false) & 0xffffff00) === 0x6d703400)
				return true

			let bytesRead = 16
			while (bytesRead < boxSize) {
				const r = sequence.getUint32(bytesRead, false)
				if ((r & 0xffffff00) === 0x6d703400) return true
				bytesRead += 4
			}

			return false
		},
		mime: "video/mp4",
	},
	// WebM
	// https://mimesniff.spec.whatwg.org/#signature-for-webm
	{
		init: () => createMatcherExact([0x1a, 0x45, 0xdf, 0xa3]),
		mime: "video/webm",
	},
	// MP3 without ID3
	// https://mimesniff.spec.whatwg.org/#signature-for-mp3-without-id3
]

// https://mimesniff.spec.whatwg.org/#matching-a-font-type-pattern
export const fontPatterns: Pattern[] = [
	{
		init: () =>
			createMatcherMasked(
				[
					0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
					0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
					0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
					0x00, 0x00, 0x00, 0x00, 0x4c, 0x50,
				],
				[
					0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
					0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
					0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
					0x00, 0x00, 0x00, 0x00, 0xff, 0xff,
				],
			),
		mime: "application/vnd.ms-fontobject",
	},
	{
		init: () => createMatcherExact([0x00, 0x01, 0x00, 0x00]),
		mime: "font/ttf",
	},
	{
		init: () => createMatcherExact([0x4f, 0x54, 0x54, 0x4f]),
		mime: "font/otf",
	},
	{
		init: () => createMatcherExact([0x74, 0x74, 0x63, 0x66]),
		mime: "font/collection",
	},
	{
		init: () => createMatcherExact([0x77, 0x4f, 0x46, 0x46]),
		mime: "font/woff",
	},
	{
		init: () => createMatcherExact([0x77, 0x4f, 0x46, 0x32]),
		mime: "font/woff2",
	},
]

// https://mimesniff.spec.whatwg.org/#matching-an-archive-type-pattern
export const archivePatterns: Pattern[] = [
	{
		init: () => createMatcherExact([0x1f, 0x8b, 0x08]),
		mime: "application/x-gzip",
	},
	{
		init: () => createMatcherExact([0x50, 0x4b, 0x03, 0x04]),
		mime: "application/zip",
	},
	// https://github.com/golang/go/blob/go1.20.7/src/net/http/sniff.go#L183-L190
	{
		init: () =>
			createMatcherExact([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]),
		mime: "application/x-rar-compressed",
	},
	{
		init: () =>
			createMatcherExact([
				0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00,
			]),
		mime: "application/x-rar-compressed",
	},
]

export const additionalPatterns: Pattern[] = [
	{
		init: () => createMatcherExact([0x00, 0x61, 0x73, 0x6d]),
		mime: "application/wasm",
	},
]

export const plaintextPattern: Pattern = {
	init: () => (data) => {
		for (let i = 0; i < data.length; i++) {
			const b = data[i]!
			if (
				b <= 0x08 ||
				b == 0x0b ||
				(0x0e <= b && b <= 0x1a) ||
				(0x1c <= b && b <= 0x1f)
			) {
				return false
			}
		}
		return true
	},
	mime: "text/plain; charset=utf-8",
}

export const selectedPatterns = [
	// ...htmlPatterns,
	...documentPatterns,
	...imagePatterns,
	...audioVideoPatterns,
	// ...fontPatterns,
	...archivePatterns,
	plaintextPattern,
]

///

// const sniffLen = 1445
const sniffLen = 512

export function detectContentType(
	data: ArrayBuffer,
	patterns: Pattern[],
): string {
	const buf = new Uint8Array(data.slice(0, sniffLen)) // resource header

	let firstNonWS = 0
	while (firstNonWS < buf.length && isWS(buf[firstNonWS]!)) {
		firstNonWS++
	}

	for (const p of patterns) {
		const matcher = p.init(firstNonWS)
		if (matcher(buf)) {
			return p.mime
		}
	}

	return MIME_OCTET
}
