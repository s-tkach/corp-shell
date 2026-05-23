"use client";

interface ModuleFederationContainer {
  init: (shareScope: Record<string, unknown>) => Promise<void>;
  get: (module: string) => Promise<() => RemoteModule>;
}

declare global {
  interface Window {
    __webpack_share_scopes__?: { default: Record<string, unknown> };
    [containerId: string]: ModuleFederationContainer | undefined;
  }
}

export interface RemoteModule {
  AppEntry: React.ComponentType<Record<string, unknown>>;
}

function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load remote: ${url}`));
    document.head.appendChild(script);
  });
}

export async function loadRemoteModule(
  remoteName: string,
  remoteEntryUrl: string
): Promise<RemoteModule> {
  await loadScript(remoteEntryUrl);

  const container = window[remoteName];

  if (!container) {
    throw new Error(`Remote container "${remoteName}" not found after loading ${remoteEntryUrl}`);
  }

  await container.init(window.__webpack_share_scopes__?.default ?? {});

  const factory = await container.get("./AppEntry");
  return factory();
}
