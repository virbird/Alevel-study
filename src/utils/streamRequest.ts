// 流式请求（fork 自 AI Study Buddy）：fetch SSE（桌面 Electron）+ XHR onprogress 降级（iPad）。
// 说明：此处必须用 fetch/XHR 而非 obsidian 的 requestUrl——requestUrl 一次性返回完整响应，
// 不支持流式（SSE）读取；非流式请求（LlmClient.chat）已全部使用 requestUrl。
export interface StreamRequestOptions {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}

export async function streamRequest(
  options: StreamRequestOptions,
  onChunk: (text: string) => void,
): Promise<void> {
  if (typeof fetch !== 'undefined') {
    await streamViaFetch(options, onChunk);
    return;
  }
  await streamViaXHR(options, onChunk);
}

// 审核 Warning 决策记录：Obsidian 推荐 requestUrl，但它不支持流式响应（SSE/ReadableStream），
// 流式场景必须保留 fetch；非流式降级路径走 XHR。
async function streamViaFetch(options: StreamRequestOptions, onChunk: (text: string) => void): Promise<void> {
  const response = await fetch(options.url, {
    method: options.method,
    headers: options.headers,
    body: options.body,
    signal: options.signal,
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API error ${response.status}: ${errorBody}`);
  }
  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (text) onChunk(text);
    }
    const remaining = decoder.decode();
    if (remaining) onChunk(remaining);
  } finally {
    reader.releaseLock();
  }
}

function streamViaXHR(options: StreamRequestOptions, onChunk: (text: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let lastIndex = 0;
    xhr.open(options.method, options.url, true);
    for (const [key, value] of Object.entries(options.headers)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.onprogress = () => {
      const newData = xhr.responseText.substring(lastIndex);
      lastIndex = xhr.responseText.length;
      if (newData) onChunk(newData);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const remaining = xhr.responseText.substring(lastIndex);
        if (remaining) onChunk(remaining);
        resolve();
      } else {
        reject(new Error(`API error ${xhr.status}: ${xhr.responseText}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.onabort = () => reject(new Error('aborted'));
    if (options.signal) {
      options.signal.addEventListener('abort', () => xhr.abort());
    }
    xhr.send(options.body);
  });
}
