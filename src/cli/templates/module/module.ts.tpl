import { defineModule } from '@iguir/core/module/define'
{{aclImport}}{{contractImport}}{{eventsImport}}{{routesImport}}
export const {{nameCamel}}Module = defineModule({
    name: '{{name}}',
{{moduleFields}}})
