function isLocalImageId(value: string): boolean {
	return /^local-img-[A-Za-z0-9_-]+(?:-[A-Za-z0-9_-]+)*$/.test(value);
}

export function reorderInlineImages(
	markdown: string,
	draggedSrc: string,
	targetSrc: string
): string {
	if (!draggedSrc || !targetSrc || draggedSrc === targetSrc) {
		return markdown;
	}

	if (!isLocalImageId(draggedSrc) || !isLocalImageId(targetSrc)) {
		return markdown;
	}

	const imageTokenRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

	const matches = Array.from(markdown.matchAll(imageTokenRegex))
		.map((match) => {
			const index = match.index;
			if (typeof index !== 'number') return null;

			const id = match[2] ?? '';
			if (!isLocalImageId(id)) return null;

			return {
				full: match[0],
				id,
				index,
				length: match[0].length
			};
		})
		.filter((m): m is NonNullable<typeof m> => m !== null);

	const dragged = matches.find((m) => m.id === draggedSrc);
	const target = matches.find((m) => m.id === targetSrc);

	if (!dragged || !target || dragged.index === target.index) {
		return markdown;
	}

	const first = dragged.index < target.index ? dragged : target;
	const second = dragged.index < target.index ? target : dragged;

	return (
		markdown.slice(0, first.index) +
		second.full +
		markdown.slice(first.index + first.length, second.index) +
		first.full +
		markdown.slice(second.index + second.length)
	);
}

export function syncImageLinesToQueue(
	value: string,
	imageQueue: { id: string; file: File; previewUrl?: string }[]
): string {
	const lines = value.split('\n');
	const regex = /^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/;

	const imageLines: Array<{ lineIndex: number; alt: string; id: string }> = [];

	lines.forEach((line, i) => {
		const m = line.match(regex);
		if (!m) return;

		const id = m[2] ?? '';
		if (!isLocalImageId(id)) return;

		imageLines.push({
			lineIndex: i,
			alt: m[1] ?? '',
			id
		});
	});

	if (imageLines.length === 0) return value;

	const queueIds = imageQueue
		.map((q) => q.id)
		.filter((id) => isLocalImageId(id));

	const present = queueIds.filter((id) =>
		imageLines.some((l) => l.id === id)
	);

	if (present.length === 0) return value;

	const altMap = new Map<string, string>();
	for (const line of imageLines) {
		if (!altMap.has(line.id)) {
			altMap.set(line.id, line.alt);
		}
	}

	for (let i = 0; i < imageLines.length && i < present.length; i++) {
		const line = imageLines[i];
		const id = present[i];
		if (!line || !id) continue;

		lines[line.lineIndex] = `![${altMap.get(id) ?? id}](${id})`;
	}

	return lines.join('\n');
}