import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { json } from '@sveltejs/kit';
import { Resource } from 'sst';
import type { RequestHandler } from './$types';

type VariantMeta = {
	field: string;
	label: string;
	format: string;
	width: number;
	height: number;
	size: number;
};

type UploadedVariant = {
	label: string;
	format: string;
	width: number;
	height: number;
	size: number;
	key: string;
};

const s3 = new S3Client({});
const ALLOWED_IMAGE_FORMATS = new Set(['image/webp', 'image/avif', 'image/png', 'image/jpeg']);

function resolveBucketName(): string {
	const linkedBucket = (Resource as unknown as Record<string, { name?: string }>)[
		'MarkdownEditorImageBucket'
	]?.name;
	if (typeof linkedBucket === 'string' && linkedBucket.trim().length > 0) {
		return linkedBucket.trim();
	}

	return (
		process.env.SST_RESOURCE_MarkdownEditorImageBucket_name ??
		process.env.PUBLIC_IMAGE_BUCKET_NAME ??
		''
	).trim();
}

function parseVariantMeta(input: string): VariantMeta[] | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(input);
	} catch {
		return null;
	}

	if (!Array.isArray(parsed) || parsed.length === 0) return null;

	const variants: VariantMeta[] = [];
	for (const value of parsed) {
		if (!value || typeof value !== 'object') return null;
		const record = value as Record<string, unknown>;

		const field = typeof record.field === 'string' ? record.field.trim() : '';
		const label = typeof record.label === 'string' ? record.label.trim() : '';
		const format = typeof record.format === 'string' ? record.format.trim().toLowerCase() : '';
		const width = Number(record.width);
		const height = Number(record.height);
		const size = Number(record.size);

		if (!field || !format || !Number.isFinite(width) || width <= 0) return null;
		if (!Number.isFinite(height) || height < 0) return null;
		if (!Number.isFinite(size) || size < 0) return null;

		variants.push({
			field,
			label: label || `w${Math.round(width)}`,
			format,
			width: Math.round(width),
			height: Math.round(height),
			size: Math.round(size)
		});
	}

	return variants;
}

function sanitizeSegment(value: string): string {
	return value.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function extensionFor(format: string): string {
	if (format === 'image/webp') return 'webp';
	if (format === 'image/avif') return 'avif';
	if (format === 'image/png') return 'png';
	return 'jpg';
}

function srcSetFromVariants(variants: UploadedVariant[], preferredFormat: string): string {
	const preferred = variants.filter((variant) => variant.format === preferredFormat);
	const pool = preferred.length > 0 ? preferred : variants;

	return pool
		.slice()
		.sort((a, b) => a.width - b.width)
		.filter((variant) => variant.width > 0)
		.map((variant) => `${variant.key} ${variant.width}w`)
		.join(', ');
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		const preferredFormat = String(formData.get('preferredFormat') ?? 'image/jpeg')
			.trim()
			.toLowerCase();
		const variantsRaw = String(formData.get('variants') ?? '[]');

		if (!id) {
			return json({ error: 'Missing id' }, { status: 400 });
		}

		const variantMeta = parseVariantMeta(variantsRaw);
		if (!variantMeta) {
			return json({ error: 'Invalid variants payload' }, { status: 400 });
		}

		const bucketName = resolveBucketName();
		if (!bucketName) {
			return json({ error: 'Bucket binding not found in environment' }, { status: 500 });
		}

		const basePath = `uploads/${sanitizeSegment(id).slice(0, 160)}`;

		const uploaded: UploadedVariant[] = [];

		for (const meta of variantMeta) {
			const blob = formData.get(meta.field);
			if (!(blob instanceof File)) {
				return json({ error: `Missing file payload for ${meta.field}` }, { status: 400 });
			}

			if (!ALLOWED_IMAGE_FORMATS.has(meta.format)) {
				return json({ error: `Unsupported format: ${meta.format}` }, { status: 400 });
			}

			const ext = extensionFor(meta.format);
			const width = Number(meta.width) || 0;
			const label = sanitizeSegment(meta.label || `w${width}`);
			const key = `${basePath}/${label}-${width}.${ext}`;
			const body = Buffer.from(await blob.arrayBuffer());

			await s3.send(
				new PutObjectCommand({
					Bucket: bucketName,
					Key: key,
					Body: body,
					ContentType: meta.format || blob.type || 'application/octet-stream',
					CacheControl: 'public, max-age=31536000, immutable'
				})
			);

			uploaded.push({
				label: meta.label,
				format: meta.format,
				width: width,
				height: Number(meta.height) || 0,
				size: Number(meta.size) || blob.size,
				key
			});
		}

		if (uploaded.length === 0) {
			return json({ error: 'No variant files uploaded' }, { status: 400 });
		}

		const preferred = uploaded
			.filter((variant) => variant.format === preferredFormat)
			.sort((a, b) => b.width - a.width)[0];
		const fallback = uploaded.slice().sort((a, b) => b.width - a.width)[0];
		const src = (preferred ?? fallback)?.key;
		const srcSet = srcSetFromVariants(uploaded, preferredFormat);

		return json({
			src,
			previewUrl: src,
			srcSet,
			variants: uploaded
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Upload failed';
		return json({ error: message }, { status: 500 });
	}
};
