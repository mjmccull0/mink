import React from 'react';
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


const items = await getCommandItems(process.argv.slice(2));

if (items.length === 0) {
    process.stderr.write("Usage: Provide --command flags or pipe a JSON array.\n");
    process.exit(1);
}

function Menu() {
	const { focus } = useFocusManager();
  const { exec } = useExec();

	const handlePress = ({
		command,
		label,
		outputFilePath,
	}: CommandItem) => exec({ command, label, outputFilePath });

	useInput(input => {
		// Look for an item that matches the character pressed
    const targetItem = items.find(item => item.key === input);

    if (targetItem) {
        focus(targetItem.key);
    }
	});

	return (
		<Box flexDirection="column" padding={1}>
			<Box borderStyle="round" paddingX={1} marginBottom={1}>
				<Text italic color="cyan">{'Select an item and press Enter'}</Text>
			</Box>

			{items.map((item) => (
				<Item
					key={item.key}
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

// 1. Open /dev/tty specifically for reading/writing
const fd = fs.openSync('/dev/tty', 'r+');

// 2. Create a proper TTY ReadStream from that file descriptor
const terminalInput = new tty.ReadStream(fd);

// 3. Make sure it's set up to be readable
terminalInput.setRawMode(true);
terminalInput.resume();

// render(<Focus />);
// Render to stderr
const { waitUntilExit } = render(React.createElement(Menu, null), {
    stdout: process.stderr,
	  stdin: terminalInput as unknown as ReadStream,
	  patchConsole: false,
});

// Wait for Ink to signal it is ready to die
await waitUntilExit();

// Cleanup after exit
terminalInput.setRawMode(false);
terminalInput.pause();
fs.closeSync(fd);
