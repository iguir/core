import { z } from 'zod'
import { defineContract } from '@iguir/core'

export const {{nameCamel}}Contract = defineContract('{{name}}', {
    // TODO: declare your contract methods, e.g.
    //   list: { input: z.void(), output: z.array(z.string()) },
})

export type {{NameTitle}}Contract = typeof {{nameCamel}}Contract
