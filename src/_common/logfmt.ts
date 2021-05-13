// https://github.com/csquared/node-logfmt/blob/master/lib/logfmt_parser.js
// MIT license (https://github.com/csquared/node-logfmt#license)

export const parse = (line: string): Record<string, string> => {
    const object: Record<string, string> = {}

    let key = ''
    let value = ''
    let in_key = false
    let in_value = false
    let in_quote = false

    if (line[line.length - 1] == '\n') {
        line = line.slice(0, line.length - 1)
    }

    for (var i = 0; i <= line.length; i++) {
        if ((line[i] == ' ' && !in_quote) || i == line.length) {
            object[key] = value
            value = ''
            if (i == line.length) {
                break
            } else {
                in_key = false
                in_value = false
                in_quote = false
            }
        }

        if (line[i] == '=' && !in_quote) {
            //split
            in_key = false
            in_value = true
        } else if (line[i] == '\\') {
            i++
            value += line[i]
        } else if (line[i] == '"') {
            in_quote = !in_quote
        } else if (line[i] != ' ' && !in_value && !in_key) {
            in_key = true
            key = line[i]!
        } else if (in_key) {
            key += line[i]
        } else if (in_value) {
            value += line[i]
        }
    }

    return object
}
