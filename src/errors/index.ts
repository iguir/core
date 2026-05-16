/**
 * Base class for any error the framework or user code wants surfaced as a
 * structured JSON response. Carries:
 *   - `code`:   stable machine-readable identifier ("posts.not_found")
 *   - `status`: HTTP status (defaults to 500)
 *   - `details`: optional payload (Zod issues, IDs, etc.) included verbatim
 *
 * Always prefer subclassing `AppError` for domain errors so the error handler
 * can render them consistently — plain `throw new Error(...)` becomes 500.
 */
export class AppError extends Error {
    readonly code: string
    readonly status: number
    readonly details: unknown

    constructor(opts: {
        code: string
        message: string
        status?: number
        details?: unknown
        cause?: unknown
    }) {
        super(
            opts.message,
            opts.cause instanceof Error ? { cause: opts.cause } : undefined,
        )
        this.name = new.target.name
        this.code = opts.code
        this.status = opts.status ?? 500
        this.details = opts.details
    }
}

/** Generic HTTP error — when no more specific subclass fits. */
export class HttpError extends AppError {
    constructor(
        status: number,
        message: string,
        opts?: { code?: string; details?: unknown },
    ) {
        super({
            code: opts?.code ?? `http.${status}`,
            message,
            status,
            details: opts?.details,
        })
    }
}

/** 400 — the client sent something malformed. */
export class BadRequestError extends AppError {
    constructor(message = 'Bad request', details?: unknown) {
        super({ code: 'bad_request', message, status: 400, details })
    }
}

/** 401 — no credentials or invalid credentials. */
export class UnauthorizedError extends AppError {
    constructor(message = 'Authentication required') {
        super({ code: 'unauthorized', message, status: 401 })
    }
}

/** 403 — authenticated but not allowed. */
export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden', details?: { permission?: string }) {
        super({ code: 'forbidden', message, status: 403, details })
    }
}

/** 404 — resource does not exist. */
export class NotFoundError extends AppError {
    constructor(message = 'Not found', details?: unknown) {
        super({ code: 'not_found', message, status: 404, details })
    }
}

/** 409 — request conflicts with current state (unique constraint, etc.). */
export class ConflictError extends AppError {
    constructor(message = 'Conflict', details?: unknown) {
        super({ code: 'conflict', message, status: 409, details })
    }
}

/**
 * 3xx — redirect the client. Loaders may throw this instead of returning data
 * to short-circuit into a redirect. The JSX renderer turns it into a real
 * redirect response with the right `Location` header.
 */
export class RedirectError extends AppError {
    readonly location: string

    constructor(location: string, status: 301 | 302 | 303 | 307 | 308 = 302) {
        super({
            code: 'redirect',
            message: `Redirecting to ${location}`,
            status,
            details: { location },
        })
        this.location = location
    }
}

/**
 * 422 — request was syntactically valid but failed semantic validation.
 * `details` carries the per-field issues (commonly a flattened Zod issue list).
 */
export class ValidationError extends AppError {
    constructor(message = 'Validation failed', details?: unknown) {
        super({ code: 'validation_failed', message, status: 422, details })
    }
}

/** True for any error that looks like an `AppError` (cross-realm safe). */
export function isAppError(value: unknown): value is AppError {
    return (
        value instanceof AppError ||
        (!!value &&
            typeof value === 'object' &&
            typeof (value as AppError).code === 'string' &&
            typeof (value as AppError).status === 'number')
    )
}
