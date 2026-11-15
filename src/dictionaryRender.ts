import type { WordEntry } from './wordListLoader';

export function formatCategory(entry: WordEntry): string {
	const parts = [entry.wordClass, entry.category].filter(Boolean);
	return parts.join(' · ');
}

export function renderUnderscoreItalics(
	container: HTMLElement,
	text: string,
): void {
	const pattern = /_([^_]+)_/g;
	let lastIndex = 0;

	for (const match of text.matchAll(pattern)) {
		const matchedText = match[0];
		const italicText = match[1] ?? '';
		const matchIndex = match.index ?? -1;
		if (matchIndex < 0) {
			continue;
		}

		const plainSegment = text.slice(lastIndex, matchIndex);
		if (plainSegment.length > 0) {
			container.createSpan({ text: plainSegment });
		}

		if (italicText.length > 0) {
			container.createEl('em', { text: italicText });
		} else {
			container.createSpan({ text: matchedText });
		}

		lastIndex = matchIndex + matchedText.length;
	}

	const trailingSegment = text.slice(lastIndex);
	if (trailingSegment.length > 0) {
		container.createSpan({ text: trailingSegment });
	}
}
