import Papa from 'papaparse';
import { normalizePath, type App, TFile } from 'obsidian';

const WORD_LIST_FILE = 'word-list.csv';

interface WordListRow {
	Word?: string;
	Category?: string;
	WordClass?: string;
	TranslationEng?: string;
	SearchTermsEng?: string;
}

export interface WordEntry {
	word: string;
	category: string;
	wordClass: string;
	translationEng: string;
	searchTermsEng: string;
}

export class DictionaryLoadError extends Error {}

export async function loadDictionaryEntries(
	app: App,
	pluginId: string,
): Promise<WordEntry[]> {
	const dictionaryPath = getDictionaryPath(pluginId);
	let csvText: string;

	try {
		const file = app.vault.getAbstractFileByPath(dictionaryPath);
		if (file instanceof TFile) {
			csvText = await app.vault.cachedRead(file);
		} else {
			// Plugin assets live under .obsidian/plugins/... and may not be indexed as TFile entries.
			csvText = await app.vault.adapter.read(dictionaryPath);
		}
	} catch (error) {
		if (error instanceof DictionaryLoadError) {
			throw error;
		}
		throw new DictionaryLoadError(
			`Could not read ${dictionaryPath}. Ensure ${WORD_LIST_FILE} is in the plugin data folder.`,
		);
	}

	const parsed = Papa.parse<WordListRow>(csvText, {
		header: true,
		skipEmptyLines: true,
	});

	if (parsed.errors.length > 0) {
		const firstError = parsed.errors[0];
		const errorMessage = firstError?.message ?? 'Unknown CSV parsing error.';
		throw new DictionaryLoadError(
			`Unable to parse ${dictionaryPath}: ${errorMessage}`,
		);
	}

	const entries = parsed.data
		.map((row) => ({
			word: clean(row.Word),
			category: clean(row.Category),
			wordClass: clean(row.WordClass),
			translationEng: clean(row.TranslationEng),
			searchTermsEng: clean(row.SearchTermsEng),
		}))
		.filter((entry) => entry.word.length > 0);

	if (entries.length === 0) {
		throw new DictionaryLoadError(
			`No usable dictionary rows were found in ${dictionaryPath}.`,
		);
	}

	return entries;
}

function getDictionaryPath(pluginId: string): string {
	return normalizePath(`.obsidian/plugins/${pluginId}/data/${WORD_LIST_FILE}`);
}

function clean(value: string | undefined): string {
	return value?.trim() ?? '';
}
