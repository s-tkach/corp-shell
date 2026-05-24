export type ParsedArgs =
  | { command: "new"; name: string }
  | { command: "init"; name: string }
  | { command: "update"; version: string | undefined }
  | { command: "help" };

export function parseArgs(argv: string[]): ParsedArgs {
  const [cmd, ...rest] = argv;

  if (cmd === "new") {
    const name = rest[0];
    if (!name) return { command: "help" };
    return { command: "new", name };
  }

  if (cmd === "init") {
    const name = rest[0];
    if (!name) return { command: "help" };
    return { command: "init", name };
  }

  if (cmd === "update") {
    const versionFlag = rest.indexOf("--version");
    const version = versionFlag !== -1 ? rest[versionFlag + 1] : undefined;
    return { command: "update", version };
  }

  return { command: "help" };
}
