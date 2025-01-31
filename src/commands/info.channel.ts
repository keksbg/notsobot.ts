import { Command, Constants, Structures, Utils } from 'detritus-client';
import { Endpoints } from 'detritus-client-rest';
import { Snowflake } from 'detritus-utils';

const { Colors } = Constants;

import { ChannelTypesText, CommandTypes, DateOptions } from '../constants';
import { GuildChannelsStored } from '../stores/guildchannels';
import { Parameters } from '../utils';


export interface CommandArgs {
  payload: {
    channel: Structures.Channel,
    channels: GuildChannelsStored,
  },
}

export default (<Command.CommandOptions> {
  name: 'channel',
  aliases: ['channelinfo'],
  label: 'payload',
  metadata: {
    description: 'Get information for a channel, defaults to the current channel',
    examples: [
      'channel',
      'channel 585639594574217232',
    ],
    type: CommandTypes.INFO,
    usage: 'channel ?<id|mention|name>',
  },
  ratelimit: {
    duration: 5000,
    limit: 5,
    type: 'guild',
  },
  type: Parameters.channelMetadata,
  onBefore: (context) => {
    const channel = context.channel;
    return (channel) ? channel.canEmbedLinks : false;
  },
  onCancel: (context) => context.editOrReply('⚠ Unable to embed information in this channel.'),
  onBeforeRun: (context, args) => !!args.payload.channel,
  onCancelRun: (context) => context.editOrReply('⚠ Unable to find that channel.'),
  run: async (context, args) => {
    args = <CommandArgs> <unknown> args;
    const { channel, channels } = args.payload;

    const embed = new Utils.Embed();
    embed.setAuthor(channel.toString(), channel.iconUrl || undefined, channel.jumpLink);
    embed.setColor(Colors.BLURPLE);
    if (channel.topic) {
      embed.setDescription(channel.topic);
    }

    {
      const description: Array<string> = [];

      description.push(`**Created**: ${channel.createdAt.toLocaleString('en-US', DateOptions)}`);
      if (channel.guildId) {
        description.push(`**Guild**: \`${channel.guildId}\``);
      }
      description.push(`**Id**: \`${channel.id}\``);
      if (channel.isManaged) {
        description.push(`**Managed**: Yes`);
      }
      if (channel.parentId) {
        description.push(`**Parent**: <#${channel.parentId}>`);
      }
      if (channel.position !== -1) {
        description.push(`**Position**: ${channel.position.toLocaleString()}`);
      }
      description.push(`**Type**: ${ChannelTypesText[channel.type] || 'Unknown'}`);

      embed.addField('Information', description.join('\n'), true);
    }

    if (channel.isText) {
      const description: Array<string> = [];

      if (channel.lastMessageId) {
        const lastMessageTimestamp = new Date(Snowflake.timestamp(channel.lastMessageId));
        description.push(`**Last Message**: ${lastMessageTimestamp.toLocaleString('en-US', DateOptions)}`);
      }
      if (channel.lastPinTimestamp) {
        description.push(`**Last Pin**: ${channel.lastPinTimestamp.toLocaleString('en-US', DateOptions)}`);
      }
      if (channel.isGuildChannel) {
        description.push(`**NSFW**: ${(channel.nsfw) ? 'Yes': 'No'}`);
        if (channel.rateLimitPerUser) {
          description.push(`*Ratelimit**: ${channel.rateLimitPerUser.toLocaleString()} seconds`);
        } else {
          description.push(`**Ratelimit**: Disabled`);
        }
      }

      embed.addField('Text Information', description.join('\n'), true);
    } else if (channel.isGuildVoice) {
      const description: Array<string> = [];

      description.push(`**Bitrate**: ${(channel.bitrate / 1000).toLocaleString()} kbps`);
      description.push(`**User Limit**: ${(channel.userLimit) ? channel.userLimit.toLocaleString() : 'Unlimited'}`);

      embed.addField('Voice Information', description.join('\n'), true);
    } else if (channel.isGuildStore) {
      const description: Array<string> = [];

      try {
        const store = await channel.fetchStoreListing();
        description.push(`Sku: ${store.sku.name}`);
      } catch(error) {
        description.push('Error fetching store data...');
      }

      embed.addField('Store', [
        '```css',
        description.join('\n'),
        '```',
      ].join('\n'));
    }

    if (channel.isDm) {
      const insideDm = (context.channelId === channel.id);
      const description: Array<string> = [];

      const owner = channel.owner;
      if (owner) {
        description.push(`**Owner**: ${(insideDm) ? owner.mention : owner}`);
      }
      const users = channel.recipients.map((user: Structures.User) => (insideDm) ? user.mention : user.toString());
      description.push(`**Recipients (${users.length})**: ${users.join(', ')}`);

      embed.addField('DM Information', description.join('\n'));
    }

    if (channel.isGuildChannel) {
      const description: Array<string> = [];

      if (channel.isGuildCategory && channels) {
        const children = channels.filter((child: Structures.Channel) => child.parentId === channel.id);
        const newsChannels = children.filter((child: Structures.Channel) => child.isGuildNews).length;
        const storeChannels = children.filter((child: Structures.Channel) => child.isGuildStore).length;
        const textChannels = children.filter((child: Structures.Channel) => child.isGuildText).length;
        const voiceChannels = children.filter((child: Structures.Channel) => child.isGuildVoice).length;

        description.push(`Children: ${children.length}`);
        if (newsChannels) {
          description.push(` -[News]: ${newsChannels.toLocaleString()}`);
        }
        if (storeChannels) {
          description.push(` -[Store]: ${storeChannels.toLocaleString()}`);
        }
        if (textChannels) {
          description.push(` -[Text]: ${textChannels.toLocaleString()}`);
        }
        if (voiceChannels) {
          description.push(` -[Voice]: ${voiceChannels.toLocaleString()}`);
        }
      }
      description.push(`Overwrites: ${channel.permissionOverwrites.length.toLocaleString()}`);

      if (description.length) {
        embed.addField('Counts', [
          '```css',
          description.join('\n'),
          '```',
        ].join('\n'), true);
      }
    }


    {
      const description: Array<string> = [];

      description.push(`[**Channel**](${channel.jumpLink})`);
      if (channel.guildId) {
        description.push(`[**Guild**](${Endpoints.Routes.URL + Endpoints.Routes.GUILD(channel.guildId)})`);
      }
      if (channel.lastMessageId) {
        const route = Endpoints.Routes.MESSAGE(channel.guildId || null, channel.id, channel.lastMessageId);
        description.push(`[**Last Message**](${Endpoints.Routes.URL + route})`)
      }

      embed.addField('Urls', description.join(', '));
    }

    return context.editOrReply({embed});
  },
  onRunError: (context, args, error) => {
    return context.editOrReply(`⚠ Error: ${error.message}`);
  },
});
