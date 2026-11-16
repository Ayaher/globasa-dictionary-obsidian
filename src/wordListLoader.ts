import Papa from 'papaparse';
import bundledWordListCsv from '../data/word-list.csv';

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

export async function loadDictionaryEntries(): Promise<WordEntry[]> {
	const parsed = Papa.parse<WordListRow>(bundledWordListCsv, {
		header: true,
		skipEmptyLines: true,
	});

	if (parsed.errors.length > 0) {
		const firstError = parsed.errors[0];
		const errorMessage = firstError?.message ?? 'Unknown CSV parsing error.';
		throw new DictionaryLoadError(`Unable to parse bundled dictionary CSV: ${errorMessage}`);
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
		throw new DictionaryLoadError('No usable dictionary rows were found in bundled dictionary CSV.');
	}

	return entries;
}

function clean(value: string | undefined): string {
	return value?.trim() ?? '';
}
