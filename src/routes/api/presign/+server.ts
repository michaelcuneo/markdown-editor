import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { json } from '@sveltejs/kit';
import { Resource } from 'sst';
import type { RequestHandler } from './$types';

const s3 = new S3Client({});

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

function normalizeKey(input: string): string {
	return input.trim().replace(/^\/+/, '');
}

export const GET: RequestHandler = async ({ url }) => {
	const bucketName = resolveBucketName();
	if (!bucketName) {
		return json({ error: 'Bucket binding not found in environment' }, { status: 500 });
	}

	const rawKey = url.searchParams.get('key') ?? '';
	const key = normalizeKey(rawKey);
	if (!key) {
		return json({ error: 'Missing key query parameter' }, { status: 400 });
	}

	try {
		const signedUrl = await getSignedUrl(
			s3,
			new GetObjectCommand({
				Bucket: bucketName,
				Key: key
			}),
			{ expiresIn: 60 * 15 }
		);

		return json({ key, url: signedUrl });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to sign URL';
		return json({ error: message }, { status: 500 });
	}
};
