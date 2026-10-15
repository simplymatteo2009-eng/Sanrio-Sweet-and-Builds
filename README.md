# Sanrio-Sweet-and-Builds

Discord bot for Chef Order pricing and staff leave requests.

## Setup

1. Install Node.js 20 or newer and run `npm install`.
2. Copy `.env.example` to `.env` and set the bot token, application ID, and server role/channel IDs.
3. Invite the bot with the `bot` and `applications.commands` scopes. Its role needs permission to send messages, embed links, read the LOA channel, and manage the LOA role. Put the bot role above the LOA role.
4. Run `npm run deploy` to register `/prices`, `/setprices`, and `/loa`, then run `npm start`.

Set `DISCORD_GUILD_ID` to register commands in one server during setup; leave it blank to register globally. Global command changes may take longer to appear.

## Commands

- `/prices` is public and displays the current Chef Order menu.
- `/setprices` opens an editable menu modal for Co-Owner roles or administrators. The menu is saved in `data/prices.json`.
- `/loa` is available to members with `STAFF_ROLE_ID`. Requests are posted to `LOA_CHANNEL_ID` for review by a Co-Owner role or an administrator. Approval assigns `LOA_ROLE_ID` through the end date (UTC); the bot removes it after that date, including after a restart.

Set `CO_OWNER_ROLE_IDS` to a comma-separated list of Co-Owner and higher roles. Administrator permission is also accepted for price updates and LOA decisions. The LOA channel must be configured in Discord so only the intended reviewers can view it; the bot does not replace existing channel permission overwrites. `data/requests.json` stores pending and approved requests and should be retained across deployments.

Dates must use `YYYY-MM-DD`. Staff receive the decision by DM; if their DMs are closed, the decision still completes and the reviewer is told that delivery failed.

Run `npm test` for the focused date and price-storage checks.