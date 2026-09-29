export class AppError extends Error {
  constructor(message, statusCode = 400, code = 'BAD_REQUEST', details = undefined) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }

  static badRequest(message, details) {
    return new AppError(message, 400, 'BAD_REQUEST', details)
  }
  static unauthorized(message = 'Not authenticated') {
    return new AppError(message, 401, 'UNAUTHORIZED')
  }
  static forbidden(message = 'Not allowed to do this') {
    return new AppError(message, 403, 'FORBIDDEN')
  }
  static notFound(message = 'Not found') {
    return new AppError(message, 404, 'NOT_FOUND')
  }
  static conflict(message) {
    return new AppError(message, 409, 'CONFLICT')
  }
}
