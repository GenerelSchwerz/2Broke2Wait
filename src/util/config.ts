import { configSchema } from './schemas'
import * as fs from 'fs'

export function loadConfig (wd: string): object {
  return JSON.parse(fs.readFileSync(wd + '/options.json').toString())
}

export function validateOptions<T extends object> (options: any): T {
  const validationResult = configSchema.validate(options, {
    abortEarly: false, // (find all errors)
    allowUnknown: true // (allow undefined values (we'll set defaults where we can))
  })

  const validationErrors = validationResult.error
  if (validationErrors != null) {
    // If error found, print error to console and kill process...
    if (validationErrors.details.length === 1) {
      console.log(
        '\x1b[36m',
        'Stopped proxy, encountered an error in config.json (you must fix it): \n'
      )
    } else {
      console.log(
        '\x1b[36m',
        'Stopped proxy, encountered ' +
            validationErrors.details.length +
            ' errors in config.json (you must fix them): \n'
      )
    }
    for (let i = 0; i < validationErrors.details.length; i++) {
      // Print helpful color-coded errors to console
      const error = validationErrors.details[i]
      console.log('\x1b[33m', 'ERROR #' + i + ': ' + error.message)
      console.log('\x1b[32m', '- Invalid Value: ' + error.context?.value)
      console.log('\x1b[32m', '- Should Be Type: ' + error.type)
      if (i !== validationErrors.details.length) {
        console.log('\x1b[36m', '')
      }
    }

    // note: process.exit(<INVALID CONFIG CODE>)
    throw new Error("Couldn't validate options.json")
  }

  return validationResult.value
}
