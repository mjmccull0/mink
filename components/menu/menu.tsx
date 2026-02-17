import React, { useState } from 'react';
import fs from 'node:fs';
import tty, { ReadStream } from 'node:tty';
import {
	render,
	Box,
	Text,
	useFocus,
	useInput,
	useFocusManager,
} from 'ink';
import { useExec } from '../../hooks/useExec.ts';
import { getCommandItems, CommandItem } from '../../utils/args.ts';

// Fetch initial items before render
const initialItems = await getCommandItems(process.argv.slice(2));

if (initialItems.length === 0) {
	process.stderr.write("Usage: Provide --command flags or pipe a JSON array.\n");
	process.exit(1);
}

function Menu({ initialItems }: { initialItems: CommandItem[] }) {
	const { focus } = useFocusManager();
	const { exec } = useExec();
	
	// State for the current menu and navigation history
	const [menuItems, setMenuItems] = useState<CommandItem[]>(initialItems);
	const [history, setHistory] = useState<CommandItem[][]>([]);

	const handlePress = async (item: CommandItem) => {
    const cmd = item.command.trim();

		// Support both 'open:' and your 'mink-open ' prefix
		if (item.command.startsWith('mink-open ') || item.command.startsWith('open:')) {
			const target = item.command.replace(/^(mink-open |open:)/, '');

			try {
				const nextItems = await getCommandItems([target]);
				
				// Save current menu to history before switching
				setHistory((prev) => [...prev, menuItems]);
				setMenuItems(nextItems);
				
				// Focus the first item of the new menu
				if (nextItems.length > 0) {
					focus(nextItems[0].key);
				}
			} catch (err) {
				process.stderr.write(`\n❌ Failed to open menu: ${target}\n`);
			}

      return;
		} 

    if (cmd === 'exit' || cmd === 'quit' || cmd === '') {
      // Results in cleaning exiting the menu process.
      exec({ ...item, command: '' });

      return;
    }

    exec(item);
	};

	const goBack = () => {
		if (history.length > 0) {
			const prevMenu = history[history.length - 1];
			setHistory((prev) => prev.slice(0, -1));
			setMenuItems(prevMenu);
			
			// Focus the first item of the previous menu
			if (prevMenu.length > 0) {
				focus(prevMenu[0].key);
			}
		}
	};

	useInput((input, key) => {
		// [Escape] or [Backspace] to go back
		if (key.escape || (key.backspace && history.length > 0)) {
			goBack();
		}

		// Quick-key selection
		const targetItem = menuItems.find(item => item.key === input);
		if (targetItem) {
			focus(targetItem.key);
		}
	});

	return (
		<Box flexDirection="column" padding={1}>
			<Box borderStyle="round" paddingX={1} marginBottom={1} flexDirection="column">
				<Text italic color="cyan">{'Select an item and press Enter'}</Text>
				{history.length > 0 && (
					<Text dimColor>Press [Esc] to go back</Text>
				)}
			</Box>

			{menuItems.map((item) => (
				<Item
					key={`${history.length}-${item.key}`} // Unique key per level
					id={item.key}
					label={item.label}
					onPress={() => handlePress(item)}
				/>
			))}
		</Box>
	);
}

function Item({ label, id, onPress }) {
	const { isFocused } = useFocus({ id });
	const displayText = `[${id}] ${label}`

	useInput((input, key) => {
		if (isFocused && (key.return || input === ' ')) {
			onPress();
		}
	});

	return (
		<Text color={isFocused ? 'green' : undefined}>
			{isFocused ? '❯ ' : '  '}
			<Text bold={isFocused}>{displayText}</Text>
		</Text>
	);
}

// --- Setup TTY ---
const fd = fs.openSync('/dev/tty', 'r+');
const terminalInput = new tty.ReadStream(fd);
terminalInput.setRawMode(true);
terminalInput.resume();

// --- Render ---
const { waitUntilExit } = render(
	<Menu initialItems={initialItems} />, 
	{
		stdout: process.stderr,
		stdin: terminalInput as unknown as ReadStream,
		patchConsole: false,
	}
);

await waitUntilExit();

// --- Cleanup ---
const cleanup = () => {
    try {
        if (terminalInput) {
            terminalInput.setRawMode(false);
            terminalInput.pause();
            // Important: remove all listeners so it doesn't 
            // capture keys during the exit phase
            terminalInput.removeAllListeners(); 
        }
        if (fd) {
            fs.closeSync(fd);
        }
    } catch (e) {
        // Silently fail if already closed
    }
};

cleanup();

// await waitUntilExit();
// 
// // Trying to fix tmux exit and eval warning
// // 1. Restore TTY
// terminalInput.setRawMode(false);
// terminalInput.pause();
// terminalInput.removeAllListeners();
// 
// // 2. Close FD
// fs.closeSync(fd);
// 
// // 3. The "Flush" - helps clear the pipe for Zsh
// process.stdout.write('');
// process.stderr.write('');
// 
// // Optional: If you still see the warning, force a clean exit code 
// // only AFTER the cleanup above is done.
// // process.exit(0);
