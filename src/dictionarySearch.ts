import type { WordEntry } from './wordListLoader';

export function matchEntries(query: string, entries: WordEntry[]): WordEntry[] {
	const normalizedQuery = normalize(query);
	if (normalizedQuery.length === 0) {
		return entries.slice().sort((left, right) => left.word.localeCompare(right.word));
	}

	return entries
		.map((entry) => ({
			entry,
			score: scoreEntry(normalizedQuery, entry),
		}))
		.filter((match) => match.score > 0)
		.sort((left, right) => {
			if (right.score !== left.score) {
				return right.score - left.score;
			}
			return left.entry.word.localeCompare(right.entry.word);
		})
		.map((match) => match.entry);
}

export function normalize(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/\p{M}+/gu, '')
		.toLowerCase()
		.trim();
}

function scoreEntry(normalizedQuery: string, entry: WordEntry): number {
	const word = normalize(entry.word);
	const english = normalize(entry.translationEng);
	const searchTerms = normalize(entry.searchTermsEng);
	const combined = [word, english, searchTerms].filter(Boolean).join(' ');
	const queryParts = normalizedQuery.split(/\s+/).filter(Boolean);

	if (word === normalizedQuery) {
		return 1000;
	}
	if (word.startsWith(normalizedQuery)) {
		return 900;
	}
	if (word.includes(normalizedQuery)) {
		return 820;
	}
	if (english.includes(normalizedQuery)) {
		return 760;
	}
	if (searchTerms.includes(normalizedQuery)) {
		return 700;
	}

	const allPartsPresent = queryParts.every((part) => combined.includes(part));
	if (allPartsPresent) {
		return 620 - queryParts.length;
	}

	const fuzzyWord = subsequenceScore(normalizedQuery, word);
	const fuzzyEnglish = subsequenceScore(normalizedQuery, english);
	const fuzzyScore = Math.max(fuzzyWord, fuzzyEnglish);
	if (fuzzyScore > 0) {
		return 300 + fuzzyScore;
	}

	return 0;
}

function subsequenceScore(query: string, text: string): number {
	if (query.length === 0 || text.length === 0) {
		return 0;
	}

	let currentIndex = 0;
	let score = 0;

	for (const character of query) {
		const nextIndex = text.indexOf(character, currentIndex);
		if (nextIndex < 0) {
			return 0;
		}

		score += nextIndex === currentIndex ? 8 : 3;
		currentIndex = nextIndex + 1;
	}

	return score / (text.length + 5);
}
