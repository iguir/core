import { defineModule } from '@iguir/core'
{{aclImport}}{{contractImport}}{{eventsImport}}{{routesImport}}
export const {{nameCamel}}Module = defineModule({
    name: '{{name}}',
{{moduleFields}}})
