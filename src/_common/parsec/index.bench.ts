import { bench, boxplot, do_not_optimize, run, summary } from "mitata"
import * as p from "."

benchmark()

async function benchmark() {
	const jsonParser = p.end(
		p.fix((json) => {
			const jsonNum = p.map(
				p.seq(
					p.opt(p.char("-")),
					p.repeat1(p.satisfy((c) => c >= "0" && c <= "9")),
					p.opt(
						p.seq(
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
				p.between(p.char('"'), p.repeat0(p.notChar('"')), p.char('"')),
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
		return r.isOk() ? r.unwrap() : r.unwrapErr()
	}

	boxplot(() => {
		summary(() => {
			bench("json", () => {
				do_not_optimize(t("null"))
				do_not_optimize(t("true"))
				do_not_optimize(t("false"))
				do_not_optimize(t("0"))
				do_not_optimize(t('""'))
				do_not_optimize(t('"hello"'))
				do_not_optimize(t("[]"))
				do_not_optimize(t("[ 123 ]"))
				do_not_optimize(t("[ 123.456 ]"))
			}).gc("inner")
		})
	})

	await run()
}
