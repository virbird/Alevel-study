import { Component } from 'obsidian';

/**
 * 短生命周期渲染组件：MarkdownRenderer.render 的 component 参数不能传插件主实例
 * （生命周期过长会泄漏），用本组件并在宿主关闭时 unload。
 * - Modal：onClose 里调用 dispose()
 * - ItemView：onClose 里调用 dispose()
 */
export class RenderScope extends Component {
  private disposed = false;

  /** 宿主关闭时调用：卸载渲染产生的子组件（可重复调用） */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.unload();
    } catch {
      // 未 load 过（从未渲染）时 unload 无意义，忽略
    }
  }

  /** 新一轮渲染前重置（先卸载旧的子组件） */
  reset(): void {
    if (this.disposed) return;
    try {
      this.unload();
    } catch {
      // 同上
    }
    this.load();
  }
}

/** 创建并立即 load 的 RenderScope */
export function createRenderScope(): RenderScope {
  const scope = new RenderScope();
  scope.load();
  return scope;
}
