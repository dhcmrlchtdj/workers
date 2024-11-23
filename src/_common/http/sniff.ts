import { MIME_OCTET } from "./mime.ts"

// https://mimesniff.spec.whatwg.org/
// Last Updated 17 July 2023
//
// https://github.com/golang/go/blob/go1.20.7/src/net/http/sniff.go#L21
// https://src.chromium.org/viewvc/chrome/trunk/src/net/base/mime_sniffer.cc

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

/* @__NO_SIDE_EFFECTS__ */
function magicNumber(mime: string, pattern: number[], skipWS = false): Pattern {
	if (skipWS) {
		return {
			mime,
			init: (firstNonWS) => (data) =>
				createMatcherExact(pattern)(data.slice(firstNonWS)),
		}
	} else {
		return { mime, init: () => createMatcherExact(pattern) }
	}
}

/* @__NO_SIDE_EFFECTS__ */
function magicNumberMask(
	mime: string,
	pattern: number[],
	mask: number[],
): Pattern {
	return { mime, init: () => createMatcherMasked(pattern, mask) }
}

/* @__NO_SIDE_EFFECTS__ */
function magicHtml(pattern: number[], mask: number[]): Pattern {
	return {
		mime: "text/html; charset=utf-8",
		init: (firstNonWS) => (data) =>
			createMatcherHtml(pattern, mask)(data.slice(firstNonWS)),
	}
}

function isTT(c: number): boolean {
	return c === 0x20 || c === 0x3e
}

function isWS(c: number): boolean {
	return c === 0x09 || c === 0x0a || c === 0x0c || c === 0x0d || c === 0x20
}

///

type Pattern = { mime: string; init: (firstNonWS: number) => Matcher }

export const htmlPatterns: Pattern[] = [
	magicHtml(
		[
			0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54, 0x59, 0x50, 0x45, 0x20, 0x48,
			0x54, 0x4d, 0x4c,
		],
		[
			0xff, 0xff, 0xdf, 0xdf, 0xdf, 0xdf, 0xdf, 0xdf, 0xdf, 0xff, 0xdf,
			0xdf, 0xdf, 0xdf,
		],
	),
	magicHtml([0x3c, 0x48, 0x54, 0x4d, 0x4c], [0xff, 0xdf, 0xdf, 0xdf, 0xdf]),
	magicHtml([0x3c, 0x48, 0x45, 0x41, 0x44], [0xff, 0xdf, 0xdf, 0xdf, 0xdf]),
	magicHtml(
		[0x3c, 0x53, 0x43, 0x52, 0x49, 0x50, 0x54],
		[0xff, 0xdf, 0xdf, 0xdf, 0xdf, 0xdf, 0xdf],
	),
	magicHtml(
		[0x3c, 0x49, 0x46, 0x52, 0x41, 0x4d, 0x45],
		[0xff, 0xdf, 0xdf, 0xdf, 0xdf, 0xdf, 0xdf],
	),
	magicHtml([0x3c, 0x48, 0x31], [0xff, 0xdf, 0xff]),
	magicHtml([0x3c, 0x44, 0x49, 0x56], [0xff, 0xdf, 0xdf, 0xdf]),
	magicHtml([0x3c, 0x46, 0x4f, 0x4e, 0x54], [0xff, 0xdf, 0xdf, 0xdf, 0xdf]),
	magicHtml(
		[0x3c, 0x54, 0x41, 0x42, 0x4c, 0x45],
		[0xff, 0xdf, 0xdf, 0xdf, 0xdf, 0xdf],
	),
	magicHtml([0x3c, 0x41], [0xff, 0xdf]),
	magicHtml(
		[0x3c, 0x53, 0x54, 0x59, 0x4c, 0x45],
		[0xff, 0xdf, 0xdf, 0xdf, 0xdf, 0xdf],
	),
	magicHtml(
		[0x3c, 0x54, 0x49, 0x54, 0x4c, 0x45],
		[0xff, 0xdf, 0xdf, 0xdf, 0xdf, 0xdf],
	),
	magicHtml([0x3c, 0x42], [0xff, 0xdf]),
	magicHtml([0x3c, 0x42, 0x4f, 0x44, 0x59], [0xff, 0xdf, 0xdf, 0xdf, 0xdf]),
	magicHtml([0x3c, 0x42, 0x52], [0xff, 0xdf, 0xdf]),
	magicHtml([0x3c, 0x50], [0xff, 0xdf]),
	magicHtml([0x3c, 0x21, 0x2d, 0x2d], [0xff, 0xff, 0xff, 0xff]),
]

export const documentPatterns: Pattern[] = [
	magicNumber(
		"image/svg+xml",
		[
			0x3c, 0x3f, 0x78, 0x6d, 0x6c, 0x5f, 0x76, 0x65, 0x72, 0x73, 0x69,
			0x6f, 0x6e, 0x3d,
		],
		true,
	),
	magicNumber(
		"text/xml; charset=utf-8",
		[0x3c, 0x3f, 0x78, 0x6d, 0x6c],
		true,
	),
	magicNumber("application/pdf", [0x25, 0x50, 0x44, 0x46, 0x2d]),
	magicNumber(
		"application/postscript",
		[0x25, 0x21, 0x50, 0x53, 0x2d, 0x41, 0x64, 0x6f, 0x62, 0x65, 0x2d],
	),
	magicNumberMask(
		"text/plain; charset=utf-16be",
		[0xfe, 0xff, 0x00, 0x00],
		[0xff, 0xff, 0x00, 0x00],
	),
	magicNumberMask(
		"text/plain; charset=utf-16le",
		[0xff, 0xfe, 0x00, 0x00],
		[0xff, 0xff, 0x00, 0x00],
	),
	magicNumberMask(
		"text/plain; charset=utf-8",
		[0xef, 0xbb, 0xbf, 0x00],
		[0xff, 0xff, 0xff, 0x00],
	),
]

// https://mimesniff.spec.whatwg.org/#matching-an-image-type-pattern
export const imagePatterns: Pattern[] = [
	magicNumber("image/x-icon", [0x00, 0x00, 0x01, 0x00]),
	magicNumber("image/x-icon", [0x00, 0x00, 0x02, 0x00]),
	magicNumber("image/bmp", [0x42, 0x4d]),
	magicNumber("image/gif", [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
	magicNumber("image/gif", [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]),
	magicNumberMask(
		"image/webp",
		[
			0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42,
			0x50, 0x56, 0x50,
		],
		[
			0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff,
			0xff, 0xff, 0xff,
		],
	),
	magicNumber("image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
	magicNumber("image/jpeg", [0xff, 0xd8, 0xff]),
]

// https://mimesniff.spec.whatwg.org/#matching-an-audio-or-video-type-pattern
export const audioVideoPatterns: Pattern[] = [
	magicNumberMask(
		"audio/aiff",
		[
			0x46, 0x4f, 0x52, 0x4d, 0x00, 0x00, 0x00, 0x00, 0x41, 0x49, 0x46,
			0x46,
		],
		[
			0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff,
			0xff,
		],
	),
	magicNumber("audio/mpeg", [0x49, 0x44, 0x33]),
	magicNumber("application/ogg", [0x4f, 0x67, 0x67, 0x53, 0x00]),
	magicNumber("audio/midi", [0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06]),
	magicNumberMask(
		"video/avi",
		[
			0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49,
			0x20,
		],
		[
			0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff,
			0xff,
		],
	),
	magicNumberMask(
		"audio/wave",
		[
			0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56,
			0x45,
		],
		[
			0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff,
			0xff,
		],
	),
	// https://mimesniff.spec.whatwg.org/#signature-for-mp4
	{
		mime: "video/mp4",
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
	},
	// https://mimesniff.spec.whatwg.org/#signature-for-webm
	magicNumber("video/webm", [0x1a, 0x45, 0xdf, 0xa3]),
	// https://mimesniff.spec.whatwg.org/#signature-for-mp3-without-id3
	// TODO
]

// https://mimesniff.spec.whatwg.org/#matching-a-font-type-pattern
export const fontPatterns: Pattern[] = [
	magicNumberMask(
		"application/vnd.ms-fontobject",
		[
			0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
			0x00, 0x4c, 0x50,
		],
		[
			0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
			0x00, 0xff, 0xff,
		],
	),
	magicNumber("font/ttf", [0x00, 0x01, 0x00, 0x00]),
	magicNumber("font/otf", [0x4f, 0x54, 0x54, 0x4f]),
	magicNumber("font/collection", [0x74, 0x74, 0x63, 0x66]),
	magicNumber("font/woff", [0x77, 0x4f, 0x46, 0x46]),
	magicNumber("font/woff2", [0x77, 0x4f, 0x46, 0x32]),
]

// https://mimesniff.spec.whatwg.org/#matching-an-archive-type-pattern
export const archivePatterns: Pattern[] = [
	magicNumber("application/x-gzip", [0x1f, 0x8b, 0x08]),
	magicNumber("application/zip", [0x50, 0x4b, 0x03, 0x04]),
	// https://github.com/golang/go/blob/go1.20.7/src/net/http/sniff.go#L183-L190
	magicNumber(
		"application/x-rar-compressed",
		[0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00],
	),
	magicNumber(
		"application/x-rar-compressed",
		[0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00],
	),
]

export const additionalPatterns: Pattern[] = [
	magicNumber("video/x-flv", [0x46, 0x4c, 0x56]),
	magicNumber("audio/flac", [0x66, 0x4c, 0x61, 0x43]),
	magicNumber("application/zstd", [0x28, 0xb5, 0x2f, 0xfd]),
	magicNumber("application/wasm", [0x00, 0x61, 0x73, 0x6d]),
]

export const plaintextPattern: Pattern = {
	mime: "text/plain; charset=utf-8",
	init: () => (data) => {
		for (let i = 0; i < data.length; i++) {
			const b = data[i]!
			if (
				b <= 0x08 ||
				b === 0x0b ||
				(0x0e <= b && b <= 0x1a) ||
				(0x1c <= b && b <= 0x1f)
			) {
				return false
			}
		}
		return true
	},
}

const allPatterns = [
	...htmlPatterns,
	...documentPatterns,
	...imagePatterns,
	...audioVideoPatterns,
	...fontPatterns,
	...archivePatterns,
	...additionalPatterns,
	plaintextPattern,
]

///

// const sniffLen = 1445
const sniffLen = 512

export function detectContentType(
	data: ArrayBufferLike,
	patterns: Pattern[] = allPatterns,
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

export const mimeToExt: Record<string, string> = {
	"application/ogg": "ogg",
	"application/pdf": "pdf",
	"application/postscript": "ps",
	"application/vnd.ms-fontobject": "eot",
	"application/wasm": "wasm",
	"application/x-gzip": "gz",
	"application/x-rar-compressed": "rar",
	"application/zip": "zip",
	"application/zstd": "zstd",
	"audio/aiff": "aiff",
	"audio/flac": "flac",
	"audio/midi": "midi",
	"audio/mpeg": "mp3",
	"audio/wave": "wav",
	"font/collection": "collection",
	"font/otf": "otf",
	"font/ttf": "ttf",
	"font/woff": "woff",
	"font/woff2": "woff2",
	"image/bmp": "bmp",
	"image/gif": "gif",
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/svg+xml": "svg",
	"image/webp": "webp",
	"image/x-icon": "ico",
	"text/html; charset=utf-8": "html",
	"text/plain; charset=utf-16be": "txt",
	"text/plain; charset=utf-16le": "txt",
	"text/plain; charset=utf-8": "txt",
	"text/xml; charset=utf-8": "xml",
	"video/avi": "avi",
	"video/mp4": "mp4",
	"video/webm": "webm",
	"video/x-flv": "flv",
}
