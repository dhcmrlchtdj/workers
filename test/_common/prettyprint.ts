import { describe, expect, test } from "@jest/globals"
import * as pp from "../../src/_common/prettyprint"

describe("prettyprint", () => {
	test("sentence", () => {
		const t = (
			sentence: string,
			toSeq: (sep: pp.Format, xs: pp.Format[]) => pp.Format,
		) => {
			const fmt = toSeq(
				pp.text(""),
				sentence.split(" ").map((x) => pp.text(x)),
			)
			let buf = ""
			const cfg = pp.config((s) => (buf += s), 80, "\n", "\t", 4)
			pp.render(fmt, cfg)
			expect(buf).toMatchSnapshot()
		}

		const sentence =
			"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
		t(sentence, pp.hSequence)
		t(sentence, pp.pSequence)
		t(sentence, pp.vSequence)
		t(sentence, pp.cSequence)
	})

	test("tree", () => {
		// https://github.com/smlnj/prettyprint/blob/main/examples/wadler-trees.sml
		type Tree = [string] | [string, Tree[]]
		const tree: Tree = [
			"aaa",
			[
				["bbbbb", [["ccc"], ["dd"]]],
				["eee"],
				["ffff", [["gg"], ["hhh"], ["ii"]]],
			],
		]
		const wadler1 = (tree: Tree): pp.Format => {
			const recur = (t: Tree[] | undefined) => {
				if (t === undefined) return pp.empty()
				return pp.cBlock([
					pp.text("["),
					pp.vSequence(pp.text(","), t.map(wadler1)),
					pp.text("]"),
				])
			}
			return pp.cBlock([pp.text(tree[0]), recur(tree[1])])
		}
		const wadler2 = (tree: Tree): pp.Format => {
			if (tree.length === 1) {
				return pp.text(tree[0])
			} else {
				return pp.vBlock([
					pp.cBlock([pp.text(tree[0]), pp.text("[")]),
					pp.indent(
						1,
						pp.vSequence(pp.text(","), tree[1].map(wadler2)),
					),
					pp.text("]"),
				])
			}
		}

		const t = (fmt: pp.Format) => {
			let buf = ""
			const cfg = pp.config((s) => (buf += s), 80, "\n", " ", 2)
			pp.render(fmt, cfg)
			expect(buf).toMatchSnapshot()
		}

		t(wadler1(tree))
		t(wadler2(tree))
	})
})
