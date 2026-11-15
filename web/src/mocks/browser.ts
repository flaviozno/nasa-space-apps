import { setupWorker } from 'msw/browser'
import { earthHandlers } from './earth-handlers'
import { handlers } from './handlers'
import { radiationHandlers } from './radiation-handlers'

export const worker = setupWorker(...handlers, ...earthHandlers, ...radiationHandlers)
