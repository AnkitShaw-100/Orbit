/**
 * An error carrying the HTTP status it should produce, so controllers and
 * services can throw meaningfully and one handler does the responding.
 * Status codes follow section 10 of the Technical Design Document.
 */
class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = "Sign in to continue") {
    return new ApiError(401, message);
  }

  static forbidden(message = "You don't have access to that") {
    return new ApiError(403, message);
  }

  static notFound(message = "Not found") {
    return new ApiError(404, message);
  }

  static conflict(message) {
    return new ApiError(409, message);
  }

  static tooManyRequests(message, details) {
    return new ApiError(429, message, details);
  }
}

module.exports = ApiError;
