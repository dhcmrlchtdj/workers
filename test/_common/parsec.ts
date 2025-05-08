import { describe, expect, test } from "@jest/globals"
import * as p from "../../src/_common/parsec"

describe("parsec", () => {
	test("parse json", () => {
		const jsonParser = p.end(
			p.fix((json) => {
				const jsonNum = p.map(
					p.seq(
						p.opt(p.char("-")),
						p.repeat1(p.satisfy((c) => c >= "0" && c <= "9")),
						p.opt(
							p.seq(
								p.char("."),
								p.repeat1(
									p.satisfy((c) => c >= "0" && c <= "9"),
								),
							),
						),
					),
					(r) => {
						let n = ""
						if (typeof r[0] === "string") n += r[0]
						n += r[1].join("")
						if (Array.isArray(r[2])) n += r[2][0] + r[2][1].join("")
						return Number(n)
					},
				)
				const jsonStr = p.map(
					p.between(
						p.char('"'),
						p.repeat0(p.notChar('"')),
						p.char('"'),
					),
					(r) => r.join(""),
				)
				const jsonBool = p.map(
					p.choice(p.str("true"), p.str("false")),
					(r) => r === "true",
				)
				const jsonNull = p.map(p.str("null"), (_) => null)
				const jsonArr = p.between(
					p.char("["),
					p.sepBy(p.char(","), json),
					p.char("]"),
				)
				const jsonObj = p.map(
					p.between(
						p.char("{"),
						p.sepBy(
							p.char(","),
							p.map(
								p.seq(
									p.space0,
									jsonStr,
									p.space0,
									p.char(":"),
									json,
								),
								(r) => [r[1], r[4]] as const,
							),
						),
						p.char("}"),
					),
					(r) => Object.fromEntries(r),
				)

				return p.between(
					p.space0,
					p.choice(
						jsonNum,
						jsonStr,
						jsonBool,
						jsonNull,
						jsonArr,
						jsonObj,
					),
					p.space0,
				)
			}),
		)
		const t = (input: string) => {
			const buf = new p.Buffered(input)
			const r = p.parse(jsonParser, buf)
			expect(r.isOk() ? r.unwrap() : r.unwrapErr()).toMatchSnapshot()
		}
		t("123")
		t("123.456")
		t("-0.789")
		t('""')
		t('"hello"')
		t("true")
		t("false")
		t("null")
		t("[]")
		t("[ true ]")
		t("[true, false]")
		t('[ 123 , true, "hello" , null]')
		t(" {} ")
		t('{ "a" : true }')
		t('{"a": true, "b": false}')
	})

	test("parse provider", async () => {
		let output = ""

		const writeChar = (c: p.Parser<string>) =>
			p.tap(c, (d) => (output += d))
		const parser = p.map(
			p.end(
				p.repeat0(
					p.seq(
						p.map(p.notEof, () => ""),
						p.map(p.repeat0(writeChar(p.notChar("["))), (r) =>
							r.join(""),
						),
						p.choice(
							p.map(
								p.seq(
									p.str("[source:"),
									p.repeat1(p.notChar("]")),
									p.str("]("),
									p.repeat1(p.notChar(")")),
									p.char(")"),
								),
								(d) => {
									const s = JSON.stringify({
										source: d[1].join(""),
										provider: d[3].join(""),
									})
									output += s
									return s
								},
							),
							writeChar(p.char("[")),
							p.map(p.eof, () => ""),
						),
					),
				),
			),
			(r) => r.map((xs) => xs[1] + xs[2]).join(""),
		)

		const stream = new p.Streaming()
		const r = p.parseAsync(parser, stream)

		const text = [
			"Lorem ipsum dolor sit amet",
			"[source:abc](https://abc)",
			"Lorem ipsum dolor sit amet",
			"[source:def](https://def)",
			"Lorem ipsum dolor sit amet",
			"[sourceghi](https://ghi)",
			"Lorem ipsum dolor sit amet",
		].join("\n")
		await text.split("").reduce(async (prev, curr) => {
			await prev
			return stream.write(curr)
		}, Promise.resolve())
		stream.end()

		expect((await r).unwrap()).toMatchSnapshot()
		expect(output).toMatchSnapshot()
	})
})
