// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
	app(input) {
		return {
			name: 'markdown-editor',
			removal: input?.stage === 'production' ? 'retain' : 'remove',
			protect: ['production'].includes(input?.stage),
			home: 'aws',
			providers: {
				aws: {
					region: 'ap-southeast-2',
					profile: 'default'
				}
			}
		};
	},
	async run() {
		const s3 = new sst.aws.Bucket('MarkdownEditorImageBucket');

		const web = new sst.aws.SvelteKit('MyWeb', {
			path: '.',
			link: [s3],
			domain: {
				name: 'markdown-editor.michaelcuneo.com.au'
			},
			invalidation: {
				paths: ['/*']
			}
		});

		return {
			s3: s3.domain,
			web: web.url
		};
	}
});
