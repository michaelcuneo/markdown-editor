export function reorderInlineImages(
	markdown: string,
	draggedSrc: string,
	targetSrc: string
): string {
	const ids = [draggedSrc, targetSrc].map((src) => {
		const m = src.match(/local-img-\d+/);
		return m ? m[0] : null;
	});
	if (!ids[0] || !ids[1]) return markdown;

	const regex = new RegExp(`(!\\[[^\\]]*\\]\\((${ids.join('|')})\\))`, 'g');
	const matches = [...markdown.matchAll(regex)];
	if (matches.length < 2) return markdown;

	const first = matches[0]?.[0];
	const second = matches[1]?.[0];
	if (!first || !second) return markdown;

	return markdown.replace(first, '__TMP__').replace(second, first).replace('__TMP__', second);
}

export function syncImageLinesToQueue(
	value: string,
	imageQueue: { id: string; file: File; previewUrl?: string }[]
): string {
	const lines = value.split('\n');
	const imgLineRegex = /^\s*!\[([^\]]*)\]\((local-img-\d+)\)\s*$/;
	const imageOnlyLines: { lineIndex: number; alt: string; id: string }[] = [];

	lines.forEach((line, i) => {
		const m = line.match(imgLineRegex);
		if (m && m[1] && m[2]) imageOnlyLines.push({ lineIndex: i, alt: m[1], id: m[2] });
	});

	if (imageOnlyLines.length === 0) return value;

	const queueIds = imageQueue.map((q) => q.id);
	const idsPresent = queueIds.filter((id) => imageOnlyLines.some((l) => l.id === id));
	if (idsPresent.length === 0) return value;

	const replacements = idsPresent.map((id) => {
		const original = imageOnlyLines.find((l) => l.id === id);
		return { alt: original?.alt ?? id, id };
	});

	for (let i = 0; i < replacements.length; i++) {
		const target = imageOnlyLines[i];
		const src = replacements[i];
		if (target && src) lines[target.lineIndex] = `![${src.alt}](${src.id})`;
	}

	return lines.join('\n');
}
