import { Command, Utils } from 'detritus-client';
import { CommandTypes } from '../constants';


export default (<Command.CommandOptions> {
  name: 'reversetext',
  aliases: ['reverse', 'r'],
  label: 'text',
  ratelimit: {
    duration: 5000,
    limit: 5,
    type: 'guild',
  },
  metadata: {
    description: 'Reverse text',
    examples: [
        'r NotSoBot'
    ],
    type: CommandTypes.FUN,
  },
  onCancelRun: (context) => context.editOrReply('Provide some text.'),
  run: async (context) => {
    const { Markup } = Utils;
    return Markup.escape.all(context.editOrReply(context.message.convertContent().split('').reverse().join()))
  },
});
