import { maybeCurrentUserId } from '../database/index.js';

/** The wrapper every Pinterest "resource" response comes in. */
export function resourceEnvelope(name, data, { bookmark = null, auxData = {}, options = {}, method = 'get' } = {}) {
  const requestId = String(Date.now());
  return {
    resource_response: {
      data,
      bookmark,
      endpoint_name: `${name}/${method}/`,
      http_status: 200,
      message: null,
      status: 'success',
      code: 0,
      metadata: {},
      aux_data: auxData,
    },
    client_context: { request_identifier: requestId, csrf_token: null, user_id: maybeCurrentUserId() },
    resource: { name, options },
    request_identifier: requestId,
  };
}

export function resourceError(name, status, message, method = 'get') {
  return {
    resource_response: {
      data: null,
      endpoint_name: `${name}/${method}/`,
      http_status: status,
      status: 'failure',
      code: status,
      message,
      message_detail: message,
    },
  };
}
