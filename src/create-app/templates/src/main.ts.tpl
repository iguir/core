import { bootstrap, createLogger, serve } from '@iguir/core'
import config from '../app.config'

const logger = createLogger({ level: process.env.LOG_LEVEL ?? 'info' })

const { app, lifecycle } = await bootstrap({
    roles: config.roles,
    modules: config.modules,
    logger,
})

const server = serve(app, config.server)
logger.info({ url: server.url.toString() }, '{{name}} listening')

lifecycle.installSignalHandlers()
