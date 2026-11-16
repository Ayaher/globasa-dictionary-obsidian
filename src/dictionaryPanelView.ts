import { ItemView, Notice, type WorkspaceLeaf } from 'obsidian';
import { formatCategory, renderUnderscoreItalics } from './dictionaryRender';
import { matchEntries } from './dictionarySearch';
import type { WordEntry } from './wordListLoader';

const MAX_RESULTS = 80;

export const DICTIONARY_VIEW_TYPE = 'globasa-dictionary-panel';

export class DictionaryPanelView extends ItemView {
	private readonly getEntries: () => WordEntry[];
	private inputEl: HTMLInputElement | null = null;
	private clearButtonEl: HTMLButtonElement | null = null;
	private countEl: HTMLDivElement | null = null;
	private resultsEl: HTMLDivElement | null = null;

	constructor(leaf: WorkspaceLeaf, getEntries: () => WordEntry[]) {
		super(leaf);
		this.getEntries = getEntries;
	}

	getViewType(): string {
		return DICTIONARY_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Dictionary';
	}

	getIcon(): string {
		return 'book-open';
	}

	async onOpen(): Promise<void> {
		this.render();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	setSearchQuery(query: string | null): void {
		if (!this.inputEl) {
			return;
		}

		this.inputEl.value = query ?? '';
		this.renderResults(this.inputEl.value);
	}

	private render() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('globasa-dictionary-panel');

		const entries = this.getEntries();

		if (entries.length === 0) {
			contentEl.createDiv({
				text: 'Dictionary unavailable. Add data/word-list.csv to the plugin folder and reload plugins.',
				cls: 'globasa-dictionary-empty-state',
			});
			return;
		}

		const searchRowEl = contentEl.createDiv({
			cls: 'globasa-dictionary-search-row',
		});

		this.inputEl = searchRowEl.createEl('input', {
			type: 'search',
			placeholder: 'Search Globasa or English...',
			cls: 'globasa-dictionary-search-input',
		});
		this.inputEl.spellcheck = false;
		this.inputEl.setAttribute('autocorrect', 'off');
		this.inputEl.setAttribute('autocapitalize', 'off');

		this.clearButtonEl = searchRowEl.createEl('button', {
			text: 'Clear',
			cls: 'globasa-dictionary-clear-button',
		});
		this.clearButtonEl.type = 'button';
		this.registerDomEvent(this.clearButtonEl, 'click', () => {
			if (!this.inputEl) {
				return;
			}
			this.inputEl.value = '';
			this.renderResults('');
			this.inputEl.focus();
		});

		this.countEl = contentEl.createDiv({
			cls: 'globasa-dictionary-match-count',
		});

		this.resultsEl = contentEl.createDiv({
			cls: 'globasa-dictionary-results',
		});

		this.registerDomEvent(this.inputEl, 'input', () => {
			this.renderResults(this.inputEl?.value ?? '');
		});

		this.renderResults('');
	}

	private renderResults(query: string) {
		if (!this.resultsEl || !this.countEl || !this.inputEl || !this.clearButtonEl) {
			return;
		}

		const normalizedQuery = query.trim();
		this.clearButtonEl.toggleClass(
			'is-visible',
			this.inputEl.value.trim().length > 0,
		);

		if (normalizedQuery.length === 0) {
			this.countEl.setText('');
			this.resultsEl.empty();
			this.resultsEl.createDiv({
				text: 'Results will appear here.',
				cls: 'globasa-dictionary-placeholder',
			});
			return;
		}

		const entries = this.getEntries();
		const matchedEntries = matchEntries(query, entries);
		const totalMatches = matchedEntries.length;
		const visibleEntries = matchedEntries.slice(0, MAX_RESULTS);

		this.updateMatchCount(visibleEntries.length, totalMatches, entries.length);

		this.resultsEl.empty();

		for (const entry of visibleEntries) {
			const rowEl = this.resultsEl.createDiv({ cls: 'globasa-dictionary-row' });
			rowEl.setAttribute('role', 'button');
			rowEl.setAttribute('tabindex', '0');
			rowEl.setAttribute('aria-label', `Copy ${entry.word} to clipboard`);
			this.registerDomEvent(rowEl, 'click', () => {
				void this.copyWordToClipboard(entry.word);
			});
			this.registerDomEvent(rowEl, 'keydown', (event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					void this.copyWordToClipboard(entry.word);
				}
			});

			const titleRow = rowEl.createDiv({ cls: 'globasa-dictionary-title-row' });
			titleRow.createEl('strong', {
				text: entry.word,
				cls: 'globasa-dictionary-word',
			});

			const categoryBadge = formatCategory(entry);
			if (categoryBadge.length > 0) {
				titleRow.createSpan({
					text: categoryBadge,
					cls: 'globasa-dictionary-badge',
				});
			}

			const translationEl = rowEl.createDiv({
				cls: 'globasa-dictionary-translation',
			});
			renderUnderscoreItalics(
				translationEl,
				entry.translationEng || 'No English meaning available.',
			);
		}
	}

	private updateMatchCount(
		visibleCount: number,
		totalMatches: number,
		totalEntries: number,
	) {
		if (!this.countEl) {
			return;
		}

		if (totalMatches === 0) {
			this.countEl.setText('No matches found.');
			return;
		}

		if (this.inputEl?.value.trim().length === 0) {
			this.countEl.setText(
				`Showing ${visibleCount} of ${totalEntries} entries — keep typing to narrow.`,
			);
			return;
		}

		if (totalMatches > visibleCount) {
			this.countEl.setText(
				`Showing ${visibleCount} of ${totalMatches} matches — keep typing to narrow.`,
			);
			return;
		}

		this.countEl.setText(`Showing ${totalMatches} matches.`);
	}

	private async copyWordToClipboard(word: string): Promise<void> {
		try {
			await copyToClipboard(word);
			new Notice(`Copied "${word}"`);
		} catch {
			new Notice(`Could not copy "${word}" to clipboard.`);
		}
	}
}

async function copyToClipboard(value: string): Promise<void> {
	if (!navigator.clipboard) {
		throw new Error('Clipboard API unavailable');
	}

	await navigator.clipboard.writeText(value);
}
