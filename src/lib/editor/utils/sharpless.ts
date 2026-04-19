export type SharplessTarget = {
	width: number;
	label: string;
};

export type SharplessVariant = {
	label: string;
	format: string;
	width: number;
	height: number;
	size: number;
	blob: Blob;
	source?: OptimizationSource;
};

export type OptimizationSource = 'sharpless' | 'canvas-fallback' | 'original-fallback' | 'pending';

export type SharplessOptimiseOptions = {
	formats?: string[];
	targets?: SharplessTarget[];
	quality?: number;
};

type SharplessModule = {
	optimiseImage?: (
		input: File | Blob | ArrayBuffer | Uint8Array,
		options?: SharplessOptimiseOptions
	) => Promise<SharplessVariant[]>;
};

export const DEFAULT_SHARPLESS_TARGETS: SharplessTarget[] = [
	{ width: 480, label: 'mobile' },
	{ width: 1024, label: 'tablet' },
	{ width: 1920, label: 'desktop' }
];

export const DEFAULT_SHARPLESS_FORMATS = ['image/webp', 'image/jpeg'];

export const DEFAULT_SHARPLESS_QUALITY = 0.82;

async function decodeImage(file: File): Promise<HTMLImageElement | null> {
	if (typeof window === 'undefined') return null;

	const objectUrl = URL.createObjectURL(file);
	try {
		const image = new Image();
		image.decoding = 'async';
		await new Promise<void>((resolve, reject) => {
			image.onload = () => resolve();
			image.onerror = () => reject(new Error('Failed to decode image'));
			image.src = objectUrl;
		});
		return image;
	} catch {
		return null;
	} finally {
		URL.revokeObjectURL(objectUrl);
	}
}

async function renderCanvasVariant(
	image: HTMLImageElement,
	width: number,
	format: string,
	quality: number
): Promise<SharplessVariant | null> {
	if (typeof document === 'undefined') return null;

	const sourceWidth = image.naturalWidth || image.width;
	const sourceHeight = image.naturalHeight || image.height;
	if (!sourceWidth || !sourceHeight) return null;

	const targetWidth = Math.max(1, Math.min(width, sourceWidth));
	const targetHeight = Math.max(1, Math.round((targetWidth / sourceWidth) * sourceHeight));

	const canvas = document.createElement('canvas');
	canvas.width = targetWidth;
	canvas.height = targetHeight;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;

	ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

	const blob = await new Promise<Blob | null>((resolve) => {
		canvas.toBlob(resolve, format, quality);
	});

	if (!blob) return null;

	return {
		label: `w${targetWidth}`,
		format,
		width: targetWidth,
		height: targetHeight,
		size: blob.size,
		blob,
		source: 'canvas-fallback'
	};
}

async function optimiseWithCanvasFallback(
	file: File,
	options: SharplessOptimiseOptions
): Promise<SharplessVariant[] | null> {
	const image = await decodeImage(file);
	if (!image) return null;

	const formats = options.formats ?? DEFAULT_SHARPLESS_FORMATS;
	const targets = options.targets ?? DEFAULT_SHARPLESS_TARGETS;
	const quality = options.quality ?? DEFAULT_SHARPLESS_QUALITY;

	const uniqueTargetWidths = Array.from(
		new Set(targets.map((target) => Math.round(target.width)).filter((width) => width > 0))
	).sort((a, b) => a - b);

	const effectiveWidths =
		uniqueTargetWidths.length > 0 ? uniqueTargetWidths : [image.naturalWidth || image.width];
	const variants: SharplessVariant[] = [];

	for (const format of formats) {
		for (const width of effectiveWidths) {
			const variant = await renderCanvasVariant(image, width, format, quality);
			if (!variant) continue;
			variants.push(variant);
		}
	}

	if (variants.length === 0) return null;
	return variants;
}

export async function optimiseImageWithSharpless(
	file: File,
	options: SharplessOptimiseOptions = {}
): Promise<SharplessVariant[]> {
	const resolvedOptions: SharplessOptimiseOptions = {
		formats: options.formats ?? DEFAULT_SHARPLESS_FORMATS,
		targets: options.targets ?? DEFAULT_SHARPLESS_TARGETS,
		quality: options.quality ?? DEFAULT_SHARPLESS_QUALITY
	};

	try {
		const moduleId = '@michaelcuneo/sharpless';
		const mod = (await import(/* @vite-ignore */ moduleId)) as SharplessModule;
		if (typeof mod.optimiseImage === 'function') {
			const variants = await mod.optimiseImage(file, resolvedOptions);
			if (
				Array.isArray(variants) &&
				variants.length > 0 &&
				variants.some((variant) => variant.width > 0)
			) {
				return variants.map((variant) => ({
					...variant,
					source: 'sharpless'
				}));
			}
		}
	} catch {
		// fall through to local fallback
	}

	const fallbackVariants = await optimiseWithCanvasFallback(file, resolvedOptions);
	if (fallbackVariants && fallbackVariants.length > 0) {
		return fallbackVariants;
	}

	return [
		{
			label: 'original',
			format: file.type || 'image/jpeg',
			width: 0,
			height: 0,
			size: file.size,
			blob: file,
			source: 'original-fallback'
		}
	];
}

export function buildSrcSet(
	variants: Array<SharplessVariant & { url: string }>,
	preferredFormat = 'image/webp'
): string {
	const filtered = variants.filter((variant) => variant.format === preferredFormat);
	const pool = filtered.length > 0 ? filtered : variants;

	return pool
		.slice()
		.sort((a, b) => a.width - b.width)
		.filter((variant) => variant.width > 0)
		.map((variant) => `${variant.url} ${variant.width}w`)
		.join(', ');
}

export function pickPreviewVariant(
	variants: Array<SharplessVariant & { url: string }>,
	preferredFormat = 'image/webp'
): (SharplessVariant & { url: string }) | null {
	const preferred = variants
		.filter((variant) => variant.format === preferredFormat)
		.sort((a, b) => b.width - a.width)[0];

	if (preferred) return preferred;

	return variants.slice().sort((a, b) => b.width - a.width)[0] ?? null;
}
