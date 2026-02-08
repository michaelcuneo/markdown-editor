// src/lib/editor/utils/highlightSetup.ts
import hljs from 'highlight.js/lib/core';

import plaintext from 'highlight.js/lib/languages/plaintext';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import bash from 'highlight.js/lib/languages/bash';
import python from 'highlight.js/lib/languages/python';

hljs.registerLanguage('plaintext', plaintext);
hljs.configure({
	languages: ['plaintext', 'javascript', 'typescript', 'json', 'xml', 'css', 'bash', 'python']
});
hljs.registerLanguage('plaintext', plaintext);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('bash', bash);
export { hljs };
