import { z } from 'zod'
import { defineContract } from '../module/contract'

/** Public schemas exposed by the auth contract. */
export const PublicUserSchema = z.object({
    id: z.string(),
    email: z.string(),
    roles: z.array(z.string()),
    createdAt: z.string(),
})

export const RegisterInputSchema = z.object({
    email: z.email(),
    password: z.string().min(8),
    roles: z.array(z.string()).default(['customer']),
})

export const LoginInputSchema = z.object({
    email: z.email(),
    password: z.string().min(1),
})

/**
 * Contract that other modules use to interact with auth — find users, register
 * users, etc. Keeps the rest of the app from importing auth internals directly
 * (enforced by the `noRestrictedImports` lint rule).
 */
export const authContract = defineContract('auth', {
    findUserById: {
        input: z.object({ id: z.string() }),
        output: PublicUserSchema.nullable(),
    },
    findUserByEmail: {
        input: z.object({ email: z.string() }),
        output: PublicUserSchema.nullable(),
    },
    registerUser: {
        input: RegisterInputSchema,
        output: PublicUserSchema,
    },
    verifyPassword: {
        input: z.object({ email: z.string(), password: z.string() }),
        output: PublicUserSchema.nullable(),
    },
})

export type AuthContract = typeof authContract
