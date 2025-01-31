import { Command, ClusterClient } from 'detritus-client';

import { CommandTypes } from '../constants';
import { onRunError, padCodeBlockFromRows } from '../utils';


export default (<Command.CommandOptions> {
  name: 'shards',
  metadata: {
    description: 'Show all of the bot\'s shard information',
    examples: [
      'shards',
    ],
    type: CommandTypes.UTILS,
    usage: 'shards',
  },
  ratelimits: [
    {
      duration: 5000,
      limit: 5,
      type: 'guild',
    },
    {
      duration: 1000,
      limit: 1,
      type: 'channel',
    },
  ],
  run: async (context) => {
    const title: Array<Array<string>> = [
      ['Shard:', String(context.shardId)],
    ];
    const rows: Array<Array<string>> = [
      ['C', 'G', 'M', 'RAM'],
    ];

    if (context.manager) {
      title.unshift(['Cluster:', String(context.manager.clusterId)]);

      const results = await context.manager.broadcastEval((cluster: ClusterClient) => {
        const usage = process.memoryUsage();
        return cluster.shards.reduce((information, shard) => {
          information.applications += shard.applications.length;
          information.channels += shard.channels.length;
          information.emojis += shard.emojis.length;
          information.guilds += shard.guilds.length;
          information.members += shard.members.length;
          information.memberCount += shard.guilds.reduce((x, guild) => x + guild.memberCount, 0);
          information.messages += shard.messages.length;
          information.notes += shard.notes.length;
          information.presences += shard.presences.length;
          information.relationships += shard.relationships.length;
          information.roles += shard.roles.length;
          information.sessions += shard.sessions.length;
          information.typings += shard.typings.length;
          information.users += shard.users.length;
          information.voiceCalls += shard.voiceCalls.length;
          information.voiceConnections += shard.voiceConnections.length;
          information.voiceStates += shard.voiceStates.length;
          return information;
        }, {
          usage: Math.max(usage.rss, usage.heapTotal + usage.external),
          applications: 0,
          channels: 0,
          emojis: 0,
          guilds: 0,
          members: 0,
          memberCount: 0,
          messages: 0,
          notes: 0,
          presences: 0,
          relationships: 0,
          roles: 0,
          sessions: 0,
          typings: 0,
          users: 0,
          voiceCalls: 0,
          voiceConnections: 0,
          voiceStates: 0,
        });
      });

      for (let clusterId in results) {
        const information = results[clusterId];
        rows.push([
          clusterId,
          String(information.guilds),
          String(information.members),
          `${Math.round(information.usage / 1024 / 1024)}`,
        ]);
      }

      const totalUsage = results.reduce((x: number, info: any) => x + info.usage, 0);
      rows.push([
        'T',
        String(results.reduce((x: number, info: any) => x + info.guilds, 0)),
        String(results.reduce((x: number, info: any) => x + info.members, 0)),
        `${Math.round(totalUsage / 1024 / 1024)}`,
      ]);
    }

    const paddedRows = padCodeBlockFromRows(rows, {join: '| '});
    const largestRow = paddedRows.reduce((x: number, row: string) => Math.max(x, row.length), 0);
    paddedRows.splice(1, 0, '-'.repeat(largestRow));

    return context.editOrReply([
      '```py',
      padCodeBlockFromRows(title).join('\n') + '\n',
      paddedRows.join('\n'),
      '```',
    ].join('\n'));
  },
  onRunError,
});
