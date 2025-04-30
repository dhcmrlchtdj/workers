import { describe, expect, test } from "@jest/globals"
import * as pp from "../../src/_common/prettyprint"
import { PlainDevice } from "../../src/_common/prettyprint"

describe("prettyprint", () => {
	test("sentence", () => {
		const t = (
			sentence: string,
			toBlock: (_: pp.Format[]) => pp.Format,
		) => {
			const device = new PlainDevice(80)
			const fmt = toBlock(sentence.split(" ").map((x) => pp.text(x)))
			pp.render(fmt, device)
			expect(device.getOutput()).toMatchSnapshot()
		}

		const sentence =
			"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
		t(sentence, pp.hBlock)
		t(sentence, pp.pBlock)
		t(sentence, pp.vBlock)
		t(sentence, pp.cBlock)
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
						2,
						pp.vSequence(pp.text(","), tree[1].map(wadler2)),
					),
					pp.text("]"),
				])
			}
		}

		const t = (fmt: pp.Format) => {
			const device = new PlainDevice(10)
			pp.render(fmt, device)
			expect(device.getOutput()).toMatchSnapshot()
		}

		t(wadler1(tree))
		t(wadler2(tree))
	})
})
