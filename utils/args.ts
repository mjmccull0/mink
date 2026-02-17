import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface CommandItem {
  key: string;
  label: string;
  command: string;
  outputFilePath: string;
}

const defaultPath = process.env.MINK_OUTPUT_PATH ||
		path.join(os.tmpdir(), `mink-exec-${process.pid}.tmp`);

/**
 * Parser that handles both:
 * 1. CLI Flags: --key k --label "Name" --command "ls"
 * 2. STDIN: echo '[{"key": "k", ...}]' | node cli.js
 */
export const getCommandItems = async (rawArgs: string[]): Promise<CommandItem[]> => {

  // Check stdin for menu options
  const stdinData = await readStdin();
  if (stdinData) {
    try {
			const rawItems: Partial<CommandItem>[] = JSON.parse(stdinData);

			// 💡 MAP DEFAULTS HERE
      return rawItems.map((item, index) => ({
        key: item.key || String(index + 1),
        label: item.label || item.command || 'Unnamed Task',
        command: item.command || '',
        outputFilePath: item.outputFilePath || defaultPath
      })) as CommandItem[];
    } catch (e) {
      process.stderr.write("❌ Error: Invalid JSON provided via STDIN\n");
      process.exit(1);
    }
  }

  // Check if the first argument is a path to a JSON file
  if (rawArgs[0] && rawArgs[0].endsWith('.json') && fs.existsSync(rawArgs[0])) {
    try {
      const fileContent = fs.readFileSync(rawArgs[0], 'utf-8');
      const rawItems: Partial<CommandItem>[] = JSON.parse(fileContent);
      
      return rawItems.map((item, index) => ({
        key: item.key || String(index + 1),
        label: item.label || item.command || 'Unnamed Task',
        command: item.command || '',
        outputFilePath: item.outputFilePath || defaultPath
      })) as CommandItem[];
    } catch (e) {
      process.stderr.write(`❌ Error: Invalid JSON in file ${rawArgs[0]}\n`);
      process.exit(1);
    }
  }

  // 2. Fallback to Grouped Prefix CLI arguments
  return parseCliArgs(rawArgs);
};

// Helper: Read piped input
const readStdin = (): Promise<string | null> => {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve(null); // No pipe detected

    let data = '';
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data.trim() || null));
  });
};

// Helper: The Grouped Prefix Logic
const parseCliArgs = (args: string[]): CommandItem[] => {
  const items: CommandItem[] = [];
  let pending: Partial<CommandItem> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Helper to grab all words until the next flag
    const consumeValue = () => {
      let parts: string[] = [];
      while (args[i + 1] && !args[i + 1].startsWith('--')) {
        parts.push(args[++i]);
      }
      return parts.join(' ');
    };

    switch (arg) {
      case '--key':
        pending.key = consumeValue();
        break;
      case '--label':
        pending.label = consumeValue();
        break;
      case '--output-file':
        pending.outputFilePath = consumeValue();
        break;
      case '--command':
        const commandValue = consumeValue();
        if (!commandValue) break;

        items.push({
          key: pending.key || String(items.length + 1),
          label: pending.label || commandValue,
          command: commandValue,
          outputFilePath: pending.outputFilePath || defaultPath
        });

        // Reset the buffer for the next item
        pending = {};
        break;
    }
  }
  return items;
};
