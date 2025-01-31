import { URLSearchParams } from 'url';

import { Command, Structures, Utils } from 'detritus-client';

const { Markup } = Utils;

import {
  CommandTypes,
  DateOptions,
  PresenceStatusColors,
  PresenceStatusTexts,
  PRESENCE_CLIENT_STATUS_KEYS,
} from '../constants';
import { Paginator, Parameters, onRunError, onTypeError, toTitleCase } from '../utils';


export interface CommandArgs {
  user: Structures.Member | Structures.User,
}

export default (<Command.CommandOptions> {
  name: 'user',
  aliases: ['userinfo', 'member', 'memberinfo'],
  label: 'user',
  metadata: {
    description: 'Get information about a user, defaults to self',
    examples: [
      'user',
      'user cake',
      'user cake#1',
      'user <@439205512425504771>',
    ],
    type: CommandTypes.INFO,
    usage: 'user ?<id|mention|name>',
  },
  ratelimit: {
    duration: 5000,
    limit: 5,
    type: 'guild',
  },
  type: Parameters.memberOrUser,
  onBefore: (context) => {
    const channel = context.channel;
    return (channel) ? channel.canEmbedLinks : false;
  },
  onCancel: (context) => context.editOrReply('⚠ Unable to embed information in this channel.'),
  onBeforeRun: (context, args) => !!args.user,
  onCancelRun: (context) => context.editOrReply('⚠ Unable to find that guy.'),
  run: async (context, args: CommandArgs) => {
    const isMember = (args.user instanceof Structures.Member);
    const member = <Structures.Member> args.user;
    const user = <Structures.User> args.user;

    const presence = user.presence;
    let activities: Array<Structures.PresenceActivity>;
    if (presence) {
      activities = presence.activities.sort((x, y) => {
        return x.position - y.position;
      });
    } else {
      activities = [];
    }
    const pageLimit = activities.length || 1;

    const paginator = new Paginator(context, {
      pageLimit,
      onPage: (page) => {
        const embed = new Utils.Embed();
        embed.setAuthor(user.toString(), user.avatarUrlFormat(null, {size: 1024}), user.jumpLink);
        embed.setColor(PresenceStatusColors['offline']);
        embed.setDescription(member.mention);
        embed.setThumbnail(user.avatarUrlFormat(null, {size: 1024}));

        {
          const description: Array<string> = [];
          description.push(`**Id**: \`${user.id}\``);
          description.push(`**Bot**: ${(user.bot) ? 'Yes' : 'No'}`);
          embed.addField('Information', description.join('\n'), true);
        }

        {
          const description: Array<string> = [];
          description.push(`**Discord**: ${user.createdAt.toLocaleString('en-US', DateOptions)}`);
          if (isMember && member.joinedAt) {
            description.push(`**Guild**: ${member.joinedAt.toLocaleString('en-US', DateOptions)}`);
          }
          embed.addField('Joined', description.join('\n'), true);
        }

        if (isMember) {
          const description: Array<string> = [];

          if (member.premiumSince) {
            description.push(`**Boosting Since**: ${member.premiumSince.toLocaleString('en-US', DateOptions)}`);
          }
          if (member.nick) {
            description.push(`**Nickname**: ${member.nick}`);
          }
          if (member.isOwner) {
            description.push('**Owner**: Yes');
          }

          const roles = member.roles
            .map((role, roleId) => role || roleId)
            .sort((x: Structures.Role | string, y: Structures.Role | string) => {
              if (x instanceof Structures.Role && y instanceof Structures.Role) {
                return x.position - y.position;
              }
              return 0;
            })
            .map((role: Structures.Role | string) => {
              if (role instanceof Structures.Role) {
                if ((role.isDefault || context.guildId !== member.guildId) && role) {
                  return `\`${role.name}\``;
                }
                return role.mention;
              }
              return `<@&${role}>`;
            });

          let rolesText = `**Roles (${roles.length})**: ${roles.join(', ')}`;
          if (800 < rolesText.length) {
            const fromIndex = rolesText.length - ((rolesText.length - 800) + 3);
            const index = rolesText.lastIndexOf(',', fromIndex);
            rolesText = rolesText.slice(0, index) + '...';
          }
          description.push(rolesText);

          const voiceChannel = member.voiceChannel;
          if (voiceChannel) {
            description.push(`**Voice**: ${voiceChannel.toString()}`);
          }
          embed.addField('Guild Specific', description.join('\n'));
        }

        if (presence) {
          if (presence.status in PresenceStatusColors) {
            embed.setColor(PresenceStatusColors[presence.status]);
          }

          if (presence.clientStatus) {
            const description = [];
            for (let key of PRESENCE_CLIENT_STATUS_KEYS) {
              let status = (<any> presence.clientStatus)[key];
              if (status) {
                if (status in PresenceStatusTexts) {
                  status = PresenceStatusTexts[status];
                }
                description.push(`**${toTitleCase(key)}**: ${status}`);
              }
            }
            embed.addField('Status', description.join('\n'));
          } else {
            let status = presence.status;
            if (status in PresenceStatusTexts) {
              status = PresenceStatusTexts[status];
            }
            embed.addField('Status', status, true);
          }

          const activityId = page - 1;
          if (activityId in activities) {
            const activity = activities[activityId];

            const description = [];
            if (activity.isCustomStatus) {
              description.push(`Custom Status: ${Markup.escape.all(activity.state || '')}`);

              if (activity.details) {
                try {
                  const details = new URLSearchParams(activity.details);
                  const channelId = details.get('c') || '';
                  if (context.channels.has(channelId)) {
                    const channel = <Structures.Channel> context.channels.get(channelId);
                    if (channel.isGuildVoice) {
                      description.push(`In Voice: ${channel.mention} (${channel.id})`);
                    }
                  }
                } catch(error) {

                }
              }
            } else {
              const text = [activity.typeText, Markup.escape.all(activity.name || '')];
              description.push(text.filter((v) => v).join(' '));
              if (activity.isOnSpotify) {
                if (activity.assets && activity.assets.largeText) {
                  description.push(`**Album**: ${activity.assets.largeText}`);
                }
                if (activity.details) {
                  description.push(`**Song**: ${activity.details}`);
                }
                if (activity.state) {
                  description.push(`**Artists**: ${activity.state.split('; ').join(', ')}`);
                }
              } else {
                if (activity.details) {
                  description.push(`**Details**: ${Markup.escape.all(activity.details)}`);
                }
                if (activity.state) {
                  description.push(`**State**: ${Markup.escape.all(activity.state)}`);
                }
              }
              if (activity.isOnXbox) {
                description.push('**On Xbox**');
              }
            }
            let name = 'Activity';
            if (1 < pageLimit) {
              name = `Activity (${page} of ${pageLimit})`;
            }
            embed.addField(name, description.join('\n'), true);
          }
        } else {
          embed.addField('Activity', PresenceStatusTexts['offline']);
        }
        return embed;
      },
    });
    return await paginator.start();
  },
  onRunError,
  onTypeError,
});
