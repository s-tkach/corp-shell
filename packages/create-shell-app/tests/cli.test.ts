import { describe, it, expect } from "vitest";
import { parseArgs } from "../src/args";

describe("parseArgs", () => {
  it("routes 'new my-app' to new subcommand", () => {
    const result = parseArgs(["new", "my-app"]);
    expect(result).toEqual({ command: "new", name: "my-app" });
  });

  it("routes 'init my-shell' to init subcommand", () => {
    const result = parseArgs(["init", "my-shell"]);
    expect(result).toEqual({ command: "init", name: "my-shell" });
  });

  it("routes 'update' with no version to update subcommand", () => {
    const result = parseArgs(["update"]);
    expect(result).toEqual({ command: "update", version: undefined });
  });

  it("routes 'update --version 1.2.0' to update subcommand", () => {
    const result = parseArgs(["update", "--version", "1.2.0"]);
    expect(result).toEqual({ command: "update", version: "1.2.0" });
  });

  it("returns help for unknown command", () => {
    const result = parseArgs(["bogus"]);
    expect(result).toEqual({ command: "help" });
  });

  it("returns help for no arguments", () => {
    const result = parseArgs([]);
    expect(result).toEqual({ command: "help" });
  });
});
