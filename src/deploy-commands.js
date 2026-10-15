import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
if (!token || !clientId) {
  throw new Error('Set DISCORD_TOKEN and DISCORD_CLIENT_ID before deploying commands.');
}

const commands = [
  new SlashCommandBuilder().setName('prices').setDescription('View the current Chef Order menu.'),
  new SlashCommandBuilder().setName('setprices').setDescription('Update the Chef Order menu.'),
  new SlashCommandBuilder().setName('loa').setDescription('Submit a staff leave request.'),
].map((command) => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);
const route = process.env.DISCORD_GUILD_ID
  ? Routes.applicationGuildCommands(clientId, process.env.DISCORD_GUILD_ID)
  : Routes.applicationCommands(clientId);

await rest.put(route, { body: commands });
console.log(`Deployed ${commands.length} slash commands.`);