import { getConversation } from '../../../../../database/index.js';
import { conversationShape } from '../../../../../schemas/index.js';

export const get = (ctx) => conversationShape(getConversation(ctx.params.conversation), ctx.origin);
