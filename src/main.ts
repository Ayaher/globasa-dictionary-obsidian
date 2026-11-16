import { Notice, Plugin, type WorkspaceLeaf } from 'obsidian';
import {
	DICTIONARY_VIEW_TYPE,
	DictionaryPanelView,
} from './dictionaryPanelView';
import { HoverDictionaryPopupController } from './hoverDictionaryPopup';
import {
	DEFAULT_SETTINGS,
	GlobasaDictionarySettings,
	GlobasaDictionarySettingTab,
} from './settings';
import {
	DictionaryLoadError,
	loadDictionaryEntries,
	type WordEntry,
} from './wordListLoader';

export default class GlobasaDictionaryPlugin extends Plugin {
	settings: GlobasaDictionarySettings = DEFAULT_SETTINGS;
	private entries: WordEntry[] = [];
	private hoverPopupController: HoverDictionaryPopupController =
		new HoverDictionaryPopupController(
			() => this.entries,
			() => ({
				routeToPanel: this.settings.showHoverResultsInPanel,
				fuzzyMatch: this.settings.enableHoverPopupFuzzyMatch,
				enableEditorView: this.settings.enableHoverPopupInEditor,
				enablePinnedPopups: this.settings.enablePinnedHoverPopups,
			}),
			(query) => {
				void this.pushHoverQueryToPanel(query);
			},
		);

	async onload() {
		await this.loadSettings();

		this.registerView(
			DICTIONARY_VIEW_TYPE,
			(leaf) => new DictionaryPanelView(leaf, () => this.entries),
		);
		this.addChild(this.hoverPopupController);
		this.addSettingTab(new GlobasaDictionarySettingTab(this.app, this));

		await this.loadDictionary();
		this.refreshHoverPopup();

		this.addRibbonIcon('book-open', 'Open dictionary panel', () => {
			void this.activateDictionaryView();
		});

		this.addCommand({
			id: 'open-dictionary-panel',
			name: 'Open dictionary panel',
			callback: () => {
				void this.activateDictionaryView();
			},
		});
	}

	onunload() {
		this.hoverPopupController.disable();
	}

	refreshHoverPopup() {
		this.hoverPopupController.syncConfiguration();

		if (
			this.settings.enableHoverPopup ||
			this.settings.showHoverResultsInPanel
		) {
			this.hoverPopupController.enable();
			return;
		}

		this.hoverPopupController.disable();
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async loadSettings() {
		const loaded = (await this.loadData()) as Partial<GlobasaDictionarySettings>;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
	}

	private async loadDictionary() {
		try {
			this.entries = await loadDictionaryEntries();
		} catch (error) {
			const message =
				error instanceof DictionaryLoadError
					? error.message
					: 'Failed to load the dictionary CSV.';
			this.entries = [];
			new Notice(`Globasa Dictionary: ${message}`);
		}
	}

	private async activateDictionaryView() {
		let leaf: WorkspaceLeaf | null =
			this.app.workspace.getLeavesOfType(DICTIONARY_VIEW_TYPE)[0] ?? null;
		if (!leaf) {
			leaf = this.app.workspace.getRightLeaf(false);
			if (!leaf) {
				new Notice('Unable to open the dictionary panel.');
				return;
			}

			await leaf.setViewState({
				type: DICTIONARY_VIEW_TYPE,
				active: true,
			});
		}

		void this.app.workspace.setActiveLeaf(leaf, {
			focus: true,
		});
	}

	private async pushHoverQueryToPanel(query: string | null) {
		if (!this.settings.showHoverResultsInPanel) {
			return;
		}

		let leaves = this.app.workspace.getLeavesOfType(DICTIONARY_VIEW_TYPE);
		if (leaves.length === 0 && query) {
			const leaf = this.app.workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({
					type: DICTIONARY_VIEW_TYPE,
					active: false,
				});
				leaves = [leaf];
			}
		}

		for (const leaf of leaves) {
			const dictionaryView = leaf.view;
			if (dictionaryView instanceof DictionaryPanelView) {
				dictionaryView.setSearchQuery(query);
			}
		}
	}
}
