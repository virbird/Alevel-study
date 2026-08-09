// obsidian 模块桩（仅供 node 冒烟测试打包用）
export class Notice { constructor(_msg?: string, _timeout?: number) {} }
export class App {}
export class Plugin {}
export class TFile {}
export class TFolder {}
export class TAbstractFile {}
export class ItemView {}
export class WorkspaceLeaf {}
export class Modal {}
export class Setting {}
export class PluginSettingTab {}
export const MarkdownRenderer = { render: async () => {} };
export function requestUrl(): never { throw new Error('not available in test'); }
