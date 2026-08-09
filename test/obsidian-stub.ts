// obsidian 模块桩（仅供 node 冒烟测试打包用）
export class Notice { constructor(_msg?: string, _timeout?: number) {} }
export class App {}
export class Plugin {}
export class TFile {}
export class TFolder {}
export class TAbstractFile {}
export class Component {
  private _loaded = false;
  private _children: Component[] = [];
  load(): void {
    if (this._loaded) throw new Error('already loaded');
    this._loaded = true;
    this.onload();
    for (const c of this._children) c.load();
  }
  onload(): void {}
  unload(): void {
    if (!this._loaded) throw new Error('not loaded');
    for (const c of this._children) c.unload();
    this.onunload();
    this._loaded = false;
  }
  onunload(): void {}
  addChild<T extends Component>(child: T): T { this._children.push(child); return child; }
  removeChild<T extends Component>(child: T): T { this._children = this._children.filter(c => c !== child); return child; }
  register(cb: () => unknown): void { void cb; }
  registerEvent(_evt: unknown): void {}
  registerInterval(id: number): number { return id; }
}
export class ItemView extends Component {}
export class WorkspaceLeaf {}
export class Modal extends Component {}
export class Setting {}
export class PluginSettingTab {}
export const MarkdownRenderer = { render: async () => {} };
export const Platform = { isMacOS: false, isMobile: false, isDesktop: true };
export function requestUrl(): never { throw new Error('not available in test'); }
