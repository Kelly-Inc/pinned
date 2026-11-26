// Errors that carry an HTTP status. Throw them from any handler; the API
// layer turns them into the right response format for the caller.
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message = 'Bad request', details) => new HttpError(400, message, details);
export const unauthorized = (message = 'Not authenticated') => new HttpError(401, message);
export const forbidden = (message = 'Not allowed') => new HttpError(403, message);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const conflict = (message = 'Conflict') => new HttpError(409, message);
export const payloadTooLarge = (message = 'Too large') => new HttpError(413, message);
export const unsupportedMedia = (message = 'Unsupported media type') => new HttpError(415, message);
