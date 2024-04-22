/* eslint-disable spaced-comment */
/* eslint-disable space-before-function-paren */
/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
import rdf from '@zazuko/env-node'
import SHACLValidator from 'rdf-validate-shacl'

import 'dotenv/config'

import pgp from 'pg-promise'
import pgUrlParse from 'pg-connection-string'
import { getIriName, printNamespaces } from '../utils.js'
import { parseFileToObjects } from './shacl-parser.js'
import { pushShaclToViziquerDb } from './db-writer.js'

const pgpOptions = {}
const pgpInstance = pgp(pgpOptions)
const pgUrlParseInstance = pgUrlParse.parse

const DB_URL = process.env.DB_URL
const DB_CONFIG = pgUrlParseInstance(DB_URL)
const db = pgpInstance(DB_CONFIG)

// class ShaclClass {
//   iri;
//   shaclProps;

//   //...class attributes...
//   constructor(iri, shaclProps = []) {
//     this.iri = iri;
//     this.shaclProps = shaclProps;
//   }
// }

// class ShaclProperty {
//   id;
//   shaclClass;

//   //...property attributes...
//   constructor(id, shaclClass = null) {
//     this.id = id;
//     this.shaclClass = shaclClass;
//   }
// }

async function main() {
  // let shapesfile = "DBPedia_SHACL_2023_processed.ttl";
  // let shapesfile = "test_SHACL.ttl";
  // let shapesfile = 'edm_SHACL.ttl'
  //let shapesfile = "DBpedia_SHACL_2023_processed_2.ttl"
  let shapesfile = "DBpedia_SHACL_2023_processed.ttl"
  let shaclPath = `../../shacl-samples/${shapesfile}`
  //let shapesfile = "LUBM_SHACL.ttl";

  printNamespaces(shaclPath)
  // prefixNamespaces(shaclPath, [
  //   { prefix: 'ssh', namespace: 'http://shaclshapes.org' },
  //   { prefix: 'sh', namespace: 'http://www.w3.org/ns/shacl' },
  //   { prefix: 'rdfsv', namespace: 'http://rdfs.org/ns/void' },
  //   { prefix: 'dbpo', namespace: 'http://dbpedia.org/ontology' },
  //   { prefix: 'odp', namespace: 'http://www.ontologydesignpatterns.org/ont/d0.owl' },
  //   { prefix: 'wkd', namespace: 'http://www.wikidata.org/entity' },
  //   { prefix: 'dbpd', namespace: 'http://dbpedia.org/datatype' },
  //   { prefix: 'foaf', namespace: 'http://xmlns.com/foaf/0.1' },
  //   { prefix: 'purl', namespace: 'http://purl.org/dc/elements/1.1' }
  // ])

  const shapes = await rdf.dataset().import(rdf.fromFile(shaclPath))
  const data = await rdf.dataset().import(rdf.fromFile('../../shacl-samples/test_SHACL_data.ttl'))

  // const validator = new SHACLValidator(shapes, { factory: rdf })
  // const report = await validator.validate(data)

  //TODO: šos aizpildīt
  //let classesByIri = {}
  //let propertiesById = {}
  //var classes = [];
  //var properties = [];
  //var bindings = [];

  let { classesByIri, propertiesById } = await parseFileToObjects(shaclPath, false)
  //parseShapesToObjects(shapes, classesByIri, propertiesById, false)
  try {
    await pushShaclToViziquerDb(classesByIri, propertiesById)
  } catch (e) {
    console.log(e)
  }

  // // Check conformance: `true` or `false`
  // console.log(report.conforms)

  // for (const result of report.results) {
  //   // See https://www.w3.org/TR/shacl/#results-validation-result for details
  //   // about each property
  //   console.log(result.message)
  //   console.log(result.path)
  //   console.log(result.focusNode)
  //   console.log(result.severity)
  //   console.log(result.sourceConstraintComponent)
  //   console.log(result.sourceShape)
  // }

  // // Validation report as RDF dataset
  // console.log(await report.dataset.serialize({ format: 'text/n3' }))
}

main()
