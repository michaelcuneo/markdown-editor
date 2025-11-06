import type MarkdownIt from 'markdown-it';

/**
 * Minimal GFM-style pipe table plugin.
 * Pure ESM and zero dependencies.
 */
export default function markdownItTables(md: MarkdownIt) {
	md.block.ruler.before('paragraph', 'table', (state, startLine, endLine, silent) => {
		const start = (state.bMarks?.[startLine] ?? 0) + (state.tShift?.[startLine] ?? 0);
		const end = state.eMarks[startLine];
		const line = state.src.slice(start, end).trim();

		if (!/^\|?(.+\|)+/.test(line)) return false;
		if (silent) return false;

		let next = startLine + 1;
		const lines: string[] = [line];
		while (next < endLine) {
			const s = (state.bMarks?.[next] ?? 0) + (state.tShift?.[next] ?? 0);
			const e = state.eMarks[next];
			const l = state.src.slice(s, e).trim();
			if (!l.startsWith('|')) break;
			lines.push(l);
			next++;
		}

		if (lines.length < 2) return false;

		const tokens = state.tokens;
		tokens.push(state.push('table_open', 'table', 1));
		tokens.push(state.push('thead_open', 'thead', 1));

		const header = (lines[0] ?? '')
			.split('|')
			.slice(1, -1)
			.map((x) => x.trim());
		tokens.push(state.push('tr_open', 'tr', 1));
		for (const h of header) {
			tokens.push(state.push('th_open', 'th', 1));
			const inline = state.push('inline', '', 0);
			inline.content = h;
			inline.children = [];
			tokens.push(state.push('th_close', 'th', -1));
		}
		tokens.push(state.push('tr_close', 'tr', -1));
		tokens.push(state.push('thead_close', 'thead', -1));

		tokens.push(state.push('tbody_open', 'tbody', 1));
		for (let i = 2; i < lines.length; i++) {
			const lineContent = lines[i];
			if (!lineContent) continue;
			const cols = lineContent
				.split('|')
				.slice(1, -1)
				.map((x) => x.trim());
			tokens.push(state.push('tr_open', 'tr', 1));
			for (const c of cols) {
				tokens.push(state.push('td_open', 'td', 1));
				const inline = state.push('inline', '', 0);
				inline.content = c;
				inline.children = [];
				tokens.push(state.push('td_close', 'td', -1));
			}
			tokens.push(state.push('tr_close', 'tr', -1));
		}
		tokens.push(state.push('tbody_close', 'tbody', -1));
		tokens.push(state.push('table_close', 'table', -1));

		state.line = next;
		return true;
	});
}
