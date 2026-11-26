// Reserve an upload slot; the client then POSTs the file to upload_url.
import { registerUpload } from '../../../../../../database/index.js';
import { uploadRegistration } from '../../../../../../schemas/index.js';

export const post = (ctx) => uploadRegistration(registerUpload(), ctx.origin);
