import { Plugin } from 'prosemirror-state';

export function linkClickPlugin() {
	let tooltipEl: HTMLDivElement | null = null;
	let active = false;

	function ensureTooltip(): HTMLDivElement {
		if (tooltipEl) return tooltipEl;
		tooltipEl = document.createElement('div');
		tooltipEl.className = 'pm-link-tooltip';
		document.body.appendChild(tooltipEl);
		return tooltipEl;
	}

	function showTooltip(x: number, y: number, href: string) {
		const el = ensureTooltip();
		el.textContent = href;
		el.style.left = `${x + 12}px`;
		el.style.top = `${y + 16}px`;
		el.classList.add('show');
	}

	function hideTooltip() {
		if (tooltipEl) tooltipEl.classList.remove('show');
	}

	return new Plugin({
		props: {
			handleDOMEvents: {
				mousemove(view, event) {
					const el = event.target as HTMLElement | null;
					const link = el?.closest('a[href]') as HTMLAnchorElement | null;
					const isMeta = event.metaKey || event.ctrlKey;

					if (link && isMeta) {
						view.dom.classList.add('pm-link-modifier');
						link.classList.add('pm-link-hover');
						active = true;
						showTooltip(event.clientX, event.clientY, link.href);
					} else if (active) {
						view.dom.classList.remove('pm-link-modifier');
						if (link) link.classList.remove('pm-link-hover');
						hideTooltip();
						active = false;
					}
					return false;
				},

				click(_view, event) {
					const link = (event.target as HTMLElement)?.closest(
						'a[href]'
					) as HTMLAnchorElement | null;
					if (!link) return false;

					if (event.metaKey || event.ctrlKey) {
						window.open(link.href, '_blank', 'noopener,noreferrer');
						event.preventDefault();
						hideTooltip();
						return true;
					}
					return false;
				},

				keydown(view, event) {
					if (event.metaKey || event.ctrlKey) {
						view.dom.classList.add('pm-link-modifier');
					}
					return false;
				},

				keyup(view) {
					view.dom.classList.remove('pm-link-modifier');
					hideTooltip();
					active = false;
					return false;
				},

				mouseleave() {
					hideTooltip();
					active = false;
					return false;
				}
			}
		}
	});
}
