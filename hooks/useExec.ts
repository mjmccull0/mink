import React from 'react';
import fs from 'node:fs';
import { useApp } from 'ink';
import { CommandItem } from '../utils/args.js';


type ExecArgs = Pick<CommandItem, 'command' | 'label' | 'outputFilePath'>;

export const useExec = () => {
  const { exit } = useApp();

  const exec = ({ command, label, outputFilePath }: ExecArgs) => {
    try {
      if (!outputFilePath) {
        throw new Error("Missing output file path.");
      }

      fs.writeFileSync(outputFilePath, command, 'utf-8');

      // Success: Graceful exit
      exit();
    } catch (error) {
      // 1. Log to stderr so the user actually sees what happened
      process.stderr.write(`\n❌ Failed to prepare task "${label}":\n${error}\n`);

      // 2. Tell Ink to exit with an error.
      // This usually allows the process to naturally exit with code 1.
      exit(error instanceof Error ? error : new Error(String(error)));

      // 3. Optional: "Safety Valve" hard exit
      // If Ink hangs for more than 500ms after a failure, force it.
      setTimeout(() => process.exit(1), 500).unref();
    }
  };

  return { exec };
};
