"use client";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }
}

export interface RemoteModule {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AppEntry: React.ComponentType<any>;
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

  const container = window[remoteName] as
    | {
        init: (shareScope: unknown) => Promise<void>;
        get: (module: string) => Promise<() => RemoteModule>;
      }
    | undefined;

  if (!container) {
    throw new Error(`Remote container "${remoteName}" not found after loading ${remoteEntryUrl}`);
  }

  // Initialize the container with the host's share scope
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await container.init((globalThis as any).__webpack_share_scopes__?.default ?? {});

  const factory = await container.get("./AppEntry");
  return factory();
}
