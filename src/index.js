/* eslint-disable spaced-comment */
/* eslint-disable space-before-function-paren */
/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
import 'dotenv/config'

import { printNamespaces } from './utils.js'
import { parseFileToObjects } from './shacl-parser.js'
import { pushShaclToViziquerDb } from './db-writer.js'


async function main() {
  let shapesfile = "DBpedia_SHACL_2023_processed.ttl"
  let shaclPath = `../../shacl-samples/${shapesfile}`

  printNamespaces(shaclPath)

  let { classesByIri, propertiesById } = await parseFileToObjects(shaclPath, false)
  
  try {
    await pushShaclToViziquerDb(classesByIri, propertiesById)
  } catch (e) {
    console.log(e)
  }
}

main()
