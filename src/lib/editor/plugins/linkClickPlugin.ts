import { Plugin } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

function isSafeHref(href: string): boolean {
	try {
		const url = new URL(href, window.location.href);
		return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol);
	} catch {
		return false;
	}
}

export function linkClickPlugin() {
	let tooltipEl: HTMLDivElement | null = null;
	let activeLink: HTMLAnchorElement | null = null;
	let modifierPressed = false;

	function ensureTooltip(): HTMLDivElement {
		if (tooltipEl) return tooltipEl;

		tooltipEl = document.createElement('div');
		tooltipEl.className = 'pm-link-tooltip';
		document.body.appendChild(tooltipEl);
		return tooltipEl;
	}

	function showTooltip(x: number, y: number, href: string): void {
		const el = ensureTooltip();
		el.textContent = href;
		el.style.left = `${x + 12}px`;
		el.style.top = `${y + 16}px`;
		el.classList.add('show');
	}

	function hideTooltip(): void {
		if (tooltipEl) {
			tooltipEl.classList.remove('show');
		}
	}

	function clearActiveLink(): void {
		if (activeLink) {
			activeLink.classList.remove('pm-link-hover');
			activeLink = null;
		}
	}

	function clearState(view?: EditorView): void {
		clearActiveLink();
		hideTooltip();

		if (view) {
			view.dom.classList.remove('pm-link-modifier');
		}
	}

	function getEditorLinkTarget(
		view: EditorView,
		target: EventTarget | null
	): HTMLAnchorElement | null {
		if (!(target instanceof HTMLElement)) return null;

		const link = target.closest('a[href]');
		if (!(link instanceof HTMLAnchorElement)) return null;
		if (!view.dom.contains(link)) return null;

		return link;
	}

	function updateHoverState(
		view: EditorView,
		event: MouseEvent | KeyboardEvent,
		target?: EventTarget | null
	): void {
		const link = target ? getEditorLinkTarget(view, target) : activeLink;

		if (!modifierPressed || !link) {
			clearState(view);
			return;
		}

		view.dom.classList.add('pm-link-modifier');

		if (activeLink !== link) {
			clearActiveLink();
			activeLink = link;
			activeLink.classList.add('pm-link-hover');
		}

		if (isSafeHref(link.href) && 'clientX' in event && 'clientY' in event) {
			showTooltip(event.clientX, event.clientY, link.href);
		} else if (isSafeHref(link.href)) {
			const rect = link.getBoundingClientRect();
			showTooltip(rect.left, rect.bottom, link.href);
		} else {
			hideTooltip();
		}
	}

	return new Plugin({
		props: {
			handleDOMEvents: {
				mousemove(view, event: Event) {
					if (!(event instanceof MouseEvent)) return false;

					modifierPressed = event.metaKey || event.ctrlKey;
					updateHoverState(view, event, event.target);
					return false;
				},

				click(view, event: Event) {
					if (!(event instanceof MouseEvent)) return false;

					const link = getEditorLinkTarget(view, event.target);
					if (!link) return false;

					const isModifierClick = event.metaKey || event.ctrlKey;
					if (!isModifierClick) return false;

					if (!isSafeHref(link.href)) {
						event.preventDefault();
						clearState(view);
						return true;
					}

					window.open(link.href, '_blank', 'noopener,noreferrer');
					event.preventDefault();
					clearState(view);
					return true;
				},

				keydown(view, event: Event) {
					if (!(event instanceof KeyboardEvent)) return false;

					const wasPressed = modifierPressed;
					modifierPressed = event.metaKey || event.ctrlKey;

					if (!wasPressed && modifierPressed) {
						view.dom.classList.add('pm-link-modifier');
						if (activeLink) {
							updateHoverState(view, event);
						}
					}

					return false;
				},

				keyup(view, event: Event) {
					if (!(event instanceof KeyboardEvent)) return false;

					modifierPressed = event.metaKey || event.ctrlKey;

					if (!modifierPressed) {
						clearState(view);
					}

					return false;
				},

				mouseleave(view) {
					clearState(view);
					return false;
				},

				blur(view) {
					modifierPressed = false;
					clearState(view);
					return false;
				}
			}
		},

		view(view) {
			return {
				destroy() {
					modifierPressed = false;
					clearState(view);

					if (tooltipEl) {
						tooltipEl.remove();
						tooltipEl = null;
					}
				}
			};
		}
	});
}