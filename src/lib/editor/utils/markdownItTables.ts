import type MarkdownIt from 'markdown-it';

export default function markdownItTables(md: MarkdownIt) {
	md.block.ruler.before('paragraph', 'table', (state, startLine, endLine, silent) => {
		const start = (state.bMarks?.[startLine] ?? 0) + (state.tShift?.[startLine] ?? 0);
		const end = state.eMarks[startLine];
		const line = state.src.slice(start, end).trim();

		if (!/^\|/.test(line)) return false;

		const sepStart = (state.bMarks?.[startLine + 1] ?? 0) + (state.tShift?.[startLine + 1] ?? 0);
		const sepEnd = state.eMarks[startLine + 1];
		const separator = state.src.slice(sepStart, sepEnd).trim();

		if (!/^\|[-:\s|]+\|$/.test(separator)) return false;
		if (silent) return true;

		const parseRow = (raw: string): string[] =>
			raw
				.split('|')
				.slice(1, -1)
				.map((value) => value.trim());

		let next = startLine + 2;
		const rows: string[][] = [];
		while (next < endLine) {
			const s = (state.bMarks?.[next] ?? 0) + (state.tShift?.[next] ?? 0);
			const e = state.eMarks[next];
			const l = state.src.slice(s, e).trim();
			if (!l.startsWith('|')) break;
			rows.push(parseRow(l));
			next++;
		}

		const header = parseRow(line);
		if (header.length === 0) return false;

		state.push('table_open', 'table', 1);
		state.push('thead_open', 'thead', 1);
		state.push('tr_open', 'tr', 1);
		for (const h of header) {
			state.push('th_open', 'th', 1);
			state.push('paragraph_open', 'p', 1);
			const inline = state.push('inline', '', 0);
			inline.content = h;
			inline.children = [];
			state.push('paragraph_close', 'p', -1);
			state.push('th_close', 'th', -1);
		}
		state.push('tr_close', 'tr', -1);
		state.push('thead_close', 'thead', -1);

		if (rows.length > 0) {
			state.push('tbody_open', 'tbody', 1);
			for (const cols of rows) {
				state.push('tr_open', 'tr', 1);
				for (const c of cols) {
					state.push('td_open', 'td', 1);
					state.push('paragraph_open', 'p', 1);
					const inline = state.push('inline', '', 0);
					inline.content = c;
					inline.children = [];
					state.push('paragraph_close', 'p', -1);
					state.push('td_close', 'td', -1);
				}
				state.push('tr_close', 'tr', -1);
			}
			state.push('tbody_close', 'tbody', -1);
		}
		state.push('table_close', 'table', -1);

		state.line = next;
		return true;
	});
}
