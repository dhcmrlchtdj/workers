import { describe, expect, test } from "@jest/globals"
import * as p from "../../src/_common/parsec"
import { StrIO } from "../../src/_common/parsec"

describe("parsec", () => {
	test("parse provider", async () => {
		const writeCh = (c: p.Parser<string>) =>
			p.mapAsync(c, async (d, io) => io.writer.write?.(d))

		const parser = p.sequence(
			p.repeat0(
				p.sequence(
					p.repeat0(writeCh(p.notChar("["))),
					p.choice(
						p.mapAsync(
							p.sequence(
								p.str("[source:"),
								p.repeat1(p.notChar("]")),
								p.str("]("),
								p.repeat1(p.notChar(")")),
								p.char(")"),
							),
							async (d, io) => {
								await io.writer.write?.(
									JSON.stringify({
										source: d[1].join(""),
										provider: d[3].join(""),
									}),
								)
								return p.EMPTY
							},
						),
						writeCh(p.char("[")),
					),
				),
			),
			p.eof,
		)

		const input = [
			"Lorem ipsum dolor sit amet",
			"[source:abc](https://abc)",
			"Lorem ipsum dolor sit amet",
			"[source:def](https://def)",
			"Lorem ipsum dolor sit amet",
			"[sourceghi](https://ghi)",
			"Lorem ipsum dolor sit amet",
		].join("\n")
		let output = ""
		const io = new StrIO<string>(input, {
			async write(data) {
				output += data
			},
		})
		await p.run(parser, io)
		expect(output).toMatchSnapshot()
	})

	test("parse json", async () => {
		const jsonParser = p.fix((jsonp) => {
			const jsonNum = p.map(
				p.sequence(
					p.optional(p.char("-")),
					p.repeat1(p.satisfy((c) => c >= "0" && c <= "9")),
					p.optional(
						p.sequence(
							p.char("."),
							p.repeat1(p.satisfy((c) => c >= "0" && c <= "9")),
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
				p.delimited(
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
			const jsonArr = p.delimited(
				p.char("["),
				p.sepBy(p.char(","), jsonp),
				p.char("]"),
			)
			const jsonObj = p.map(
				p.delimited(
					p.char("{"),
					p.sepBy(
						p.char(","),
						p.map(
							p.sequence(
								p.space0,
								jsonStr,
								p.space0,
								p.char(":"),
								jsonp,
							),
							(r) => [r[1], r[4]] as const,
						),
					),
					p.char("}"),
				),
				(r) => Object.fromEntries(r),
			)

			return p.delimited(
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
		})
		const t = async (input: string) => {
			const io = new StrIO<string>(input)
			const r = await p.run(jsonParser, io)
			expect(r.isOk() ? r.unwrap() : r.unwrapErr()).toMatchSnapshot()
		}
		await t("123")
		await t("123.456")
		await t("-0.789")
		await t('""')
		await t('"hello"')
		await t("true")
		await t("false")
		await t("null")
		await t("[]")
		await t("[ true ]")
		await t("[true, false]")
		await t('[ 123 , true, "hello" , null]')
		await t(" {} ")
		await t('{ "a" : true }')
		await t('{"a": true, "b": false}')
	})
})
