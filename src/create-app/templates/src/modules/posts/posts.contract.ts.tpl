import { z } from 'zod'
import { defineContract } from '@iguir/core'

export const PostSchema = z.object({
    id: z.string(),
    title: z.string().min(1),
    body: z.string(),
    authorId: z.string(),
    createdAt: z.string(),
})

export const postsContract = defineContract('posts', {
    list: {
        input: z.void(),
        output: z.array(PostSchema),
    },
    findById: {
        input: z.object({ id: z.string() }),
        output: PostSchema.nullable(),
    },
})

export type PostsContract = typeof postsContract
