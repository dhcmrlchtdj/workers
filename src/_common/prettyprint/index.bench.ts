import { bench, boxplot, do_not_optimize, run, summary } from "mitata"
import * as pp from "."

benchmark()

async function benchmark() {
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
				pp.indent(1, pp.vSequence(pp.text(","), tree[1].map(wadler2))),
				pp.text("]"),
			])
		}
	}

	boxplot(() => {
		summary(() => {
			bench("wadler1", () => {
				let buf = ""
				const cfg = pp.config((s) => (buf += s), 80, "\n", " ", 2)
				pp.render(wadler1(tree), cfg)
				do_not_optimize(buf)
			}).gc('inner')
			bench("wadler1.1", () => {
				let buf: string[] = []
				const cfg = pp.config((s) => buf.push(s), 80, "\n", " ", 2)
				pp.render(wadler1(tree), cfg)
				do_not_optimize(buf.join(""))
			}).gc('inner')
		})
		summary(() => {
			bench("wadler2", () => {
				let buf = ""
				const cfg = pp.config((s) => (buf += s), 80, "\n", " ", 2)
				pp.render(wadler2(tree), cfg)
				do_not_optimize(buf)
			}).gc('inner')
			bench("wadler2.1", () => {
				let buf:string[] = []
				const cfg = pp.config((s) => (buf.push(s)), 80, "\n", " ", 2)
				pp.render(wadler2(tree), cfg)
				do_not_optimize(buf.join(""))
			}).gc('inner')
		})
	})

	await run()
}
