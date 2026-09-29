import { customAlphabet } from 'nanoid'

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
const gen = customAlphabet(alphabet, 12)

export const makeId = (prefix) => `${prefix}_${gen()}`

const tokenAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const genToken = customAlphabet(tokenAlphabet, 24)
export const makeToken = () => genToken()
