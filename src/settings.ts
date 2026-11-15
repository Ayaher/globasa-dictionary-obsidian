import { App, PluginSettingTab, Setting } from 'obsidian';
import type GlobasaDictionaryPlugin from './main';

export interface GlobasaDictionarySettings {
	enableHoverPopup: boolean;
	showHoverResultsInPanel: boolean;
	enableHoverPopupFuzzyMatch: boolean;
	enableHoverPopupInEditor: boolean;
	enablePinnedHoverPopups: boolean;
}

export const DEFAULT_SETTINGS: GlobasaDictionarySettings = {
	enableHoverPopup: false,
	showHoverResultsInPanel: false,
	enableHoverPopupFuzzyMatch: false,
	enableHoverPopupInEditor: false,
	enablePinnedHoverPopups: false,
};

export class GlobasaDictionarySettingTab extends PluginSettingTab {
	private readonly plugin: GlobasaDictionaryPlugin;

	constructor(app: App, plugin: GlobasaDictionaryPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions() {
		return [
			{
				name: 'Enable hover dictionary popup',
				desc: 'Show dictionary entry popups while hovering words in reading mode.',
				control: { type: 'toggle', key: 'enableHoverPopup' },
			},
			{
				name: 'Show hover results in dictionary panel',
				desc: 'Disable popup overlays and push hover search results into the dictionary panel instead.',
				control: { type: 'toggle', key: 'showHoverResultsInPanel' },
			},
			{
				name: 'Use fuzzy matching in hover popup',
				desc: 'When disabled, hover popup only appears for exact globasa word matches. Enable if you also hover english words.',
				control: { type: 'toggle', key: 'enableHoverPopupFuzzyMatch' },
			},
			{
				name: 'Enable hover popup in editor view',
				desc: 'Allow hover popups in editing/source mode, not only reading mode.',
				control: { type: 'toggle', key: 'enableHoverPopupInEditor' },
			},
			{
				name: 'Enable pinnable hover popups',
				desc: 'Allow pinning hover popups as draggable floating cards by clicking the hovered word. Only one pinned card per distinct word.',
				control: { type: 'toggle', key: 'enablePinnedHoverPopups' },
			},
		];
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Enable hover dictionary popup')
			.setDesc(
				'Show dictionary entry popups while hovering words in reading mode.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableHoverPopup)
					.onChange(async (value) => {
						this.plugin.settings.enableHoverPopup = value;
						await this.plugin.saveSettings();
						this.plugin.refreshHoverPopup();
					}),
			);

		new Setting(containerEl)
			.setName('Show hover results in dictionary panel')
			.setDesc(
				'Disable popup overlays and push hover search results into the dictionary panel instead.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showHoverResultsInPanel)
					.onChange(async (value) => {
						this.plugin.settings.showHoverResultsInPanel = value;
						await this.plugin.saveSettings();
						this.plugin.refreshHoverPopup();
					}),
			);

		new Setting(containerEl)
			.setName('Use fuzzy matching in hover popup')
			.setDesc(
				'When disabled, hover popup only appears for exact globasa word matches. Enable if you also hover english words.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableHoverPopupFuzzyMatch)
					.onChange(async (value) => {
						this.plugin.settings.enableHoverPopupFuzzyMatch = value;
						await this.plugin.saveSettings();
						this.plugin.refreshHoverPopup();
					}),
			);

		new Setting(containerEl)
			.setName('Enable hover popup in editor view')
			.setDesc('Allow hover popups in editing/source mode, not only reading mode.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableHoverPopupInEditor)
					.onChange(async (value) => {
						this.plugin.settings.enableHoverPopupInEditor = value;
						await this.plugin.saveSettings();
						this.plugin.refreshHoverPopup();
					}),
			);

		new Setting(containerEl)
			.setName('Enable pinnable hover popups')
			.setDesc(
				'Allow pinning hover popups as draggable floating cards by clicking the hovered word. Only one pinned card per distinct word.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enablePinnedHoverPopups)
					.onChange(async (value) => {
						this.plugin.settings.enablePinnedHoverPopups = value;
						await this.plugin.saveSettings();
						this.plugin.refreshHoverPopup();
					}),
			);
	}
}
