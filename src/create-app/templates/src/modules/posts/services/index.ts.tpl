import type { z } from 'zod'
import type { PostSchema } from '../posts.contract'

type Post = z.infer<typeof PostSchema>

/**
 * In-memory posts store. Replace with Drizzle when you wire posts to your
 * database — the rest of the module won't have to change.
 */
export function createPostsService() {
    const posts: Post[] = []

    return {
        list(): Post[] {
            return [...posts]
        },
        findById(id: string): Post | null {
            return posts.find((p) => p.id === id) ?? null
        },
        create(input: { title: string; body: string; authorId: string }): Post {
            const post: Post = {
                id: crypto.randomUUID(),
                title: input.title,
                body: input.body,
                authorId: input.authorId,
                createdAt: new Date().toISOString(),
            }
            posts.unshift(post)
            return post
        },
        delete(id: string): boolean {
            const i = posts.findIndex((p) => p.id === id)
            if (i < 0) return false
            posts.splice(i, 1)
            return true
        },
    }
}

export type PostsService = ReturnType<typeof createPostsService>
