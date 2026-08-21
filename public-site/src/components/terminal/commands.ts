export interface CommandOutput {
  type: 'text' | 'redirect';
  content: string;
}

export interface Command {
  name: string;
  aliases: string[];
  description: string;
  handler: (args: string[]) => CommandOutput | Promise<CommandOutput>;
}

export const COMMANDS: Command[] = [
  {
    name: 'help',
    aliases: ['?', 'commands'],
    description: 'List available commands',
    handler: () => ({
      type: 'text' as const,
      content: COMMANDS.map(
        (c) => `  ${c.name.padEnd(14)} ${c.description}`
      ).join('\n'),
    }),
  },
  {
    name: 'now',
    aliases: ['current', 'status'],
    description: 'What Travis is working on',
    handler: () => ({ type: 'redirect' as const, content: '/now' }),
  },
  {
    name: 'random',
    aliases: ['surprise', 'lucky'],
    description: 'Navigate to essays',
    handler: () => ({ type: 'redirect' as const, content: '/essays' }),
  },
];

export function matchCommand(input: string): { command: Command; args: string[] } | null {
  const parts = input.trim().split(/\s+/);
  const first = parts[0]?.toLowerCase();
  if (!first) return null;

  const cmd = COMMANDS.find(
    (c) => c.name === first || c.aliases.includes(first)
  );
  if (!cmd) return null;

  return { command: cmd, args: parts.slice(1) };
}
