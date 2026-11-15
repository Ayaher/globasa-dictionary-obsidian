import { Notice } from 'obsidian';
import { formatCategory, renderUnderscoreItalics } from './dictionaryRender';
import { matchEntries, normalize } from './dictionarySearch';
import type { WordEntry } from './wordListLoader';

const POPUP_MARGIN = 8;
const POPUP_GAP = 10;
const WORD_PATTERN = /[A-Za-zÀ-ÖØ-öø-ÿ0-9'-]/;
const HIGHLIGHT_NAME = 'globasa-hover-word';

type CaretPoint = { node: Node; offset: number };
type HoverPopupOptions = {
	routeToPanel: boolean;
	fuzzyMatch: boolean;
	enableEditorView: boolean;
	enablePinnedPopups: boolean;
};
type HoverToken = {
	key: string;
	token: string;
	textNode: Text;
	start: number;
	end: number;
	anchorRect: DOMRect;
};
type HighlightRegistry = {
	set: (name: string, highlight: unknown) => void;
	delete: (name: string) => void;
};
type HighlightEnvironment = {
	Highlight?: new (range: Range) => unknown;
	CSS?: { highlights?: HighlightRegistry };
};
const NODE_IDS = new WeakMap<Node, number>();
let NODE_ID_COUNTER = 0;

export class HoverDictionaryPopupController {
	private readonly getEntries: () => WordEntry[];
	private readonly getOptions: () => HoverPopupOptions;
	private popupEl: HTMLDivElement | null = null;
	private popupBodyEl: HTMLDivElement | null = null;
	private popupPinButtonEl: HTMLButtonElement | null = null;
	private popupCloseButtonEl: HTMLButtonElement | null = null;
	private abortController: AbortController | null = null;
	private currentTokenKey: string | null = null;
	private currentEntry: WordEntry | null = null;
	private pinnedPopups = new Map<string, HTMLDivElement>();
	private readonly onHoverQuery: (query: string | null) => void;

	constructor(
		getEntries: () => WordEntry[],
		getOptions: () => HoverPopupOptions,
		onHoverQuery: (query: string | null) => void,
	) {
		this.getEntries = getEntries;
		this.getOptions = getOptions;
		this.onHoverQuery = onHoverQuery;
	}

	syncConfiguration(): void {
		const options = this.getOptions();

		if (!options.enablePinnedPopups) {
			this.removeAllPinnedPopups();
		}

		if (this.popupPinButtonEl) {
			this.popupPinButtonEl.classList.add('is-hidden');
		}
		if (this.popupCloseButtonEl) {
			this.popupCloseButtonEl.classList.toggle(
				'is-hidden',
				!options.fuzzyMatch || options.routeToPanel,
			);
		}
	}

	enable(): void {
		if (this.abortController) {
			return;
		}

		this.abortController = new AbortController();
		document.addEventListener('mousemove', this.handleMouseMove, {
			passive: true,
			signal: this.abortController.signal,
		});
		document.addEventListener('scroll', this.handleHide, {
			passive: true,
			signal: this.abortController.signal,
		});
		document.addEventListener('keydown', this.handleHide, {
			signal: this.abortController.signal,
		});
		document.addEventListener('click', this.handleClick, {
			signal: this.abortController.signal,
		});
	}

	disable(): void {
		this.abortController?.abort();
		this.abortController = null;
		this.hideTransientPopup();
		this.removeAllPinnedPopups();
	}

	private readonly handleMouseMove = (event: MouseEvent): void => {
		const target = event.target;
		if (!(target instanceof HTMLElement)) {
			this.hideTransientPopup();
			return;
		}

		const isPopupTarget = Boolean(
			target.closest('.globasa-dictionary-hover-popup') ||
				target.closest('.globasa-dictionary-pinned-popup'),
		);
		if (isPopupTarget) {
			return;
		}

		const options = this.getOptions();
		if (!isInAllowedView(target, options.enableEditorView)) {
			this.hideTransientPopup();
			return;
		}

		const hoverToken = getTokenAtPoint(event.clientX, event.clientY);
		if (!hoverToken) {
			this.hideTransientPopup();
			return;
		}

		if (hoverToken.key === this.currentTokenKey) {
			return;
		}

		const entry = findEntryForHover(
			hoverToken.token,
			this.getEntries(),
			options.fuzzyMatch,
		);
		if (!entry) {
			this.hideTransientPopup();
			return;
		}

		this.currentTokenKey = hoverToken.key;
		this.applyWordHighlight(hoverToken);

		if (options.routeToPanel) {
			this.onHoverQuery(hoverToken.token);
			this.hideTransientPopupOnly();
			return;
		}

		this.renderTransientPopup(entry);
		this.positionPopupNearAnchor(hoverToken.anchorRect);
	};

	private readonly handleClick = (event: MouseEvent): void => {
		const options = this.getOptions();
		if (!options.enablePinnedPopups || options.routeToPanel) {
			return;
		}
		if (!this.popupEl?.classList.contains('is-visible')) {
			return;
		}

		const hoverToken = getTokenAtPoint(event.clientX, event.clientY);
		if (!hoverToken || hoverToken.key !== this.currentTokenKey) {
			return;
		}

		this.pinCurrentPopup();
	};

	private readonly handleHide = (): void => {
		this.hideTransientPopup();
	};

	private renderTransientPopup(entry: WordEntry): void {
		const popup = this.ensureTransientPopup();
		if (!this.popupBodyEl) {
			return;
		}

		this.popupBodyEl.empty();
		renderPopupContent(this.popupBodyEl, entry);
		if (this.getOptions().enablePinnedPopups) {
			this.popupBodyEl.createDiv({
				cls: 'globasa-dictionary-popup-hint',
				text: 'Tip: click the hovered word to pin this card.',
			});
		}
		popup.dataset.word = normalize(entry.word);
		this.currentEntry = entry;
		popup.classList.add('is-visible');
	}

	private applyWordHighlight(token: HoverToken): void {
		const highlightEnvironment = window as unknown as HighlightEnvironment;
		const HighlightConstructor = highlightEnvironment.Highlight;
		const highlightRegistry = highlightEnvironment.CSS?.highlights;
		if (!HighlightConstructor || !highlightRegistry) {
			return;
		}

		const range = document.createRange();
		range.setStart(token.textNode, token.start);
		range.setEnd(token.textNode, token.end);
		highlightRegistry.set(HIGHLIGHT_NAME, new HighlightConstructor(range));
	}

	private positionPopupNearAnchor(anchorRect: DOMRect): void {
		if (!this.popupEl || !this.popupEl.classList.contains('is-visible')) {
			return;
		}

		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const popupRect = this.popupEl.getBoundingClientRect();

		let left = anchorRect.left;
		let top = anchorRect.bottom + POPUP_GAP;

		if (left + popupRect.width > viewportWidth - POPUP_MARGIN) {
			left = viewportWidth - popupRect.width - POPUP_MARGIN;
		}
		if (left < POPUP_MARGIN) {
			left = POPUP_MARGIN;
		}

		if (top + popupRect.height > viewportHeight - POPUP_MARGIN) {
			top = anchorRect.top - popupRect.height - POPUP_GAP;
		}
		if (top < POPUP_MARGIN) {
			top = POPUP_MARGIN;
		}

		this.popupEl.setCssProps({
			'--globasa-popup-left': `${left}px`,
			'--globasa-popup-top': `${top}px`,
		});
	}

	private ensureTransientPopup(): HTMLDivElement {
		if (this.popupEl) {
			return this.popupEl;
		}

		this.popupEl = document.body.createDiv({
			cls: 'globasa-dictionary-hover-popup',
		});

		const header = this.popupEl.createDiv({
			cls: 'globasa-dictionary-hover-popup-header',
		});

		this.popupPinButtonEl = header.createEl('button', {
			text: 'Pin',
			cls: 'globasa-dictionary-popup-action is-hidden',
		});
		this.popupPinButtonEl.type = 'button';

		const closeButton = header.createEl('button', {
			text: 'Close',
			cls: 'globasa-dictionary-popup-action',
		});
		closeButton.type = 'button';
		closeButton.addEventListener('click', () => {
			this.hideTransientPopup();
		});
		this.popupCloseButtonEl = closeButton;
		closeButton.classList.toggle('is-hidden', !this.getOptions().fuzzyMatch);

		this.popupBodyEl = this.popupEl.createDiv({
			cls: 'globasa-dictionary-hover-popup-body',
		});

		return this.popupEl;
	}

	private pinCurrentPopup(): void {
		if (!this.popupEl || !this.popupBodyEl || !this.currentEntry) {
			return;
		}

		if (!this.popupEl.classList.contains('is-visible')) {
			return;
		}

		const options = this.getOptions();
		if (!options.enablePinnedPopups) {
			return;
		}

		const normalizedWord = this.popupEl.dataset.word ?? '';
		if (!normalizedWord) {
			return;
		}

		if (this.pinnedPopups.has(normalizedWord)) {
			new Notice('A pinned popup for this word already exists.');
			return;
		}

		const pinned = document.body.createDiv({
			cls: 'globasa-dictionary-pinned-popup',
		});
		pinned.setCssProps({
			'--globasa-popup-left': getComputedStyle(this.popupEl).getPropertyValue(
				'--globasa-popup-left',
			),
			'--globasa-popup-top': getComputedStyle(this.popupEl).getPropertyValue(
				'--globasa-popup-top',
			),
		});

		const header = pinned.createDiv({
			cls: 'globasa-dictionary-hover-popup-header globasa-dictionary-drag-handle',
		});
		header.createSpan({
			text: 'Pinned',
			cls: 'globasa-dictionary-pinned-label',
		});

		const closeButton = header.createEl('button', {
			text: 'Close',
			cls: 'globasa-dictionary-popup-action',
		});
		closeButton.type = 'button';
		closeButton.addEventListener('click', () => {
			pinned.remove();
			this.pinnedPopups.delete(normalizedWord);
		});

		const body = pinned.createDiv({
			cls: 'globasa-dictionary-hover-popup-body',
		});
		renderPopupContent(body, this.currentEntry);

		makeElementDraggable(pinned, header);

		this.pinnedPopups.set(normalizedWord, pinned);
	}

	private hideTransientPopup(): void {
		this.currentTokenKey = null;
		this.currentEntry = null;
		clearWordHighlight();

		this.hideTransientPopupOnly();
	}

	private hideTransientPopupOnly(): void {
		if (!this.popupEl) {
			return;
		}

		this.popupEl.classList.remove('is-visible');
	}

	private removeAllPinnedPopups(): void {
		for (const popup of this.pinnedPopups.values()) {
			popup.remove();
		}
		this.pinnedPopups.clear();
	}
}

function isInAllowedView(target: HTMLElement, allowEditorView: boolean): boolean {
	const inReadingView = Boolean(
		target.closest('.markdown-reading-view') ||
			target.closest('.markdown-preview-view'),
	);
	if (inReadingView) {
		return true;
	}

	if (!allowEditorView) {
		return false;
	}

	return Boolean(
		target.closest('.markdown-source-view') || target.closest('.cm-editor'),
	);
}

function findEntryForHover(
	token: string,
	entries: WordEntry[],
	useFuzzy: boolean,
): WordEntry | null {
	const normalizedToken = normalize(token);
	const exactMatch =
		entries.find((entry) => normalize(entry.word) === normalizedToken) ?? null;
	if (exactMatch) {
		return exactMatch;
	}

	if (!useFuzzy) {
		return null;
	}

	return matchEntries(token, entries)[0] ?? null;
}

function getTokenAtPoint(clientX: number, clientY: number): HoverToken | null {
	const caretData = getCaretAtPoint(clientX, clientY);
	if (!caretData || caretData.node.nodeType !== Node.TEXT_NODE) {
		return null;
	}

	const textNode = caretData.node as Text;
	const text = textNode.textContent ?? '';
	if (text.length === 0) {
		return null;
	}

	const offset = caretData.offset;
	if (offset < 0 || offset >= text.length) {
		return null;
	}
	if (!WORD_PATTERN.test(text.charAt(offset))) {
		return null;
	}

	let start = offset;
	let end = offset + 1;

	while (start > 0 && WORD_PATTERN.test(text.charAt(start - 1))) {
		start -= 1;
	}
	while (end < text.length && WORD_PATTERN.test(text.charAt(end))) {
		end += 1;
	}

	const token = text.slice(start, end).trim();
	if (token.length === 0) {
		return null;
	}

	const range = document.createRange();
	range.setStart(textNode, start);
	range.setEnd(textNode, end);
	const rects = Array.from(range.getClientRects());
	const hitRect = rects.find((rect) => isPointInsideRect(clientX, clientY, rect));
	const anchorRect = hitRect ?? rects[0] ?? range.getBoundingClientRect();
	if (!isPointInsideRect(clientX, clientY, anchorRect)) {
		return null;
	}

	return {
		key: `${getNodeKey(textNode)}:${start}:${end}`,
		token,
		textNode,
		start,
		end,
		anchorRect,
	};
}

function getCaretAtPoint(clientX: number, clientY: number): CaretPoint | null {
	const doc = document as Document & {
		caretPositionFromPoint?: (
			x: number,
			y: number,
		) => { offsetNode: Node; offset: number } | null;
	};

	const caretPosition = doc.caretPositionFromPoint?.(clientX, clientY);
	if (!caretPosition) {
		return null;
	}

	return {
		node: caretPosition.offsetNode,
		offset: caretPosition.offset,
	};
}

function renderPopupContent(container: HTMLElement, entry: WordEntry): void {
	const titleRow = container.createDiv({ cls: 'globasa-dictionary-title-row' });
	titleRow.createEl('strong', {
		text: entry.word,
		cls: 'globasa-dictionary-word',
	});

	const badge = formatCategory(entry);
	if (badge.length > 0) {
		titleRow.createSpan({
			text: badge,
			cls: 'globasa-dictionary-badge',
		});
	}

	const translationEl = container.createDiv({
		cls: 'globasa-dictionary-translation',
	});
	renderUnderscoreItalics(
		translationEl,
		entry.translationEng || 'No English meaning available.',
	);
}

function makeElementDraggable(element: HTMLElement, handle: HTMLElement): void {
	let startLeft = 0;
	let startTop = 0;
	let startMouseX = 0;
	let startMouseY = 0;
	let dragging = false;

	handle.addEventListener('pointerdown', (event) => {
		if (!(event.target instanceof HTMLElement)) {
			return;
		}
		if (event.target.closest('button')) {
			return;
		}

		const computed = getComputedStyle(element);
		startLeft = parseFloat(computed.getPropertyValue('--globasa-popup-left')) || 0;
		startTop = parseFloat(computed.getPropertyValue('--globasa-popup-top')) || 0;
		startMouseX = event.clientX;
		startMouseY = event.clientY;
		dragging = true;
		handle.setPointerCapture(event.pointerId);
		event.preventDefault();
	});

	handle.addEventListener('pointermove', (event) => {
		if (!dragging) {
			return;
		}

		const nextLeft = startLeft + (event.clientX - startMouseX);
		const nextTop = startTop + (event.clientY - startMouseY);
		element.setCssProps({
			'--globasa-popup-left': `${nextLeft}px`,
			'--globasa-popup-top': `${nextTop}px`,
		});
	});

	const endDrag = (event: PointerEvent): void => {
		if (!dragging) {
			return;
		}

		dragging = false;
		handle.releasePointerCapture(event.pointerId);
	};

	handle.addEventListener('pointerup', endDrag);
	handle.addEventListener('pointercancel', endDrag);
}

function isPointInsideRect(x: number, y: number, rect: DOMRect): boolean {
	return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function getNodeKey(node: Node): string {
	const existingId = NODE_IDS.get(node);
	if (existingId !== undefined) {
		return String(existingId);
	}

	NODE_ID_COUNTER += 1;
	NODE_IDS.set(node, NODE_ID_COUNTER);
	return String(NODE_ID_COUNTER);
}

function clearWordHighlight(): void {
	const highlightEnvironment = window as unknown as HighlightEnvironment;
	highlightEnvironment.CSS?.highlights?.delete(HIGHLIGHT_NAME);
}
