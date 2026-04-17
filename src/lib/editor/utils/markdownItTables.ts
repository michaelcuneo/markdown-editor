import type MarkdownIt from 'markdown-it';

type Align = 'left' | 'center' | 'right' | null;

function splitRow(raw: string): string[] {
	let line = raw.trim();

	if (line.startsWith('|')) line = line.slice(1);
	if (line.endsWith('|')) line = line.slice(0, -1);

	return line.split('|').map((value) => value.trim());
}

function parseSeparator(raw: string): Align[] | null {
	const cells = splitRow(raw);
	if (cells.length === 0) return null;

	const aligns: Align[] = [];

	for (const cell of cells) {
		const trimmed = cell.trim();
		if (!/^:?-{3,}:?$/.test(trimmed)) return null;

		const left = trimmed.startsWith(':');
		const right = trimmed.endsWith(':');

		if (left && right) aligns.push('center');
		else if (left) aligns.push('left');
		else if (right) aligns.push('right');
		else aligns.push(null);
	}

	return aligns;
}

export default function markdownItTables(md: MarkdownIt) {
	md.block.ruler.before('table', 'pm_table', (state, startLine, endLine, silent) => {
		if (startLine + 1 >= endLine) return false;

		const getLine = (lineNo: number): string => {
			const start = (state.bMarks[lineNo] ?? 0) + (state.tShift[lineNo] ?? 0);
			const end = state.eMarks[lineNo] ?? start;
			return state.src.slice(start, end).trim();
		};

		const headerLine = getLine(startLine);
		const separatorLine = getLine(startLine + 1);

		if (!headerLine.startsWith('|')) return false;

		const header = splitRow(headerLine);
		const aligns = parseSeparator(separatorLine);

		if (!aligns) return false;
		if (header.length === 0 || header.length !== aligns.length) return false;

		if (silent) return true;

		let nextLine = startLine + 2;
		const rows: string[][] = [];

		while (nextLine < endLine) {
			const rowLine = getLine(nextLine);
			if (!rowLine.startsWith('|')) break;

			const cols = splitRow(rowLine);
			if (cols.length !== header.length) break;

			rows.push(cols);
			nextLine++;
		}

		state.push('table_open', 'table', 1);

		state.push('tr_open', 'tr', 1);
		for (let i = 0; i < header.length; i += 1) {
			const th = state.push('th_open', 'th', 1);
			if (aligns[i]) th.attrs = [['style', `text-align:${aligns[i]}`]];

			state.push('paragraph_open', 'p', 1);
			const inline = state.push('inline', '', 0);
			inline.content = header[i] ?? '';
			inline.children = [];
			state.push('paragraph_close', 'p', -1);

			state.push('th_close', 'th', -1);
		}
		state.push('tr_close', 'tr', -1);

		for (const row of rows) {
			state.push('tr_open', 'tr', 1);

			for (let i = 0; i < row.length; i += 1) {
				const td = state.push('td_open', 'td', 1);
				if (aligns[i]) td.attrs = [['style', `text-align:${aligns[i]}`]];

				state.push('paragraph_open', 'p', 1);
				const inline = state.push('inline', '', 0);
				inline.content = row[i] ?? '';
				inline.children = [];
				state.push('paragraph_close', 'p', -1);

				state.push('td_close', 'td', -1);
			}

			state.push('tr_close', 'tr', -1);
		}

		state.push('table_close', 'table', -1);
		state.line = nextLine;
		return true;
	});
}
