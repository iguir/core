import { z } from 'zod'
import { defineContract } from '@iguir/core'

/** Safe-for-API projection of a user. Never includes `passwordHash`. */
export const PublicUserSchema = z.object({
    id: z.string(),
    email: z.string(),
    roles: z.array(z.string()),
    createdAt: z.string(),
})
export type PublicUser = z.infer<typeof PublicUserSchema>

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
 * Other modules import this contract to interact with auth. The
 * cross-module-import lint rule enforces that only `*.contract.ts` files
 * cross the module boundary.
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
