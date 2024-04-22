/* eslint-disable spaced-comment */
/* eslint-disable space-before-function-paren */
/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
import rdf from '@zazuko/env-node'
import SHACLValidator from 'rdf-validate-shacl'

import 'dotenv/config'

import pgp from 'pg-promise'
import pgUrlParse from 'pg-connection-string'
import { printNamespaces } from './utils.js'

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
  let classesByIri = {}
  let propertiesById = {}
  //var classes = [];
  //var properties = [];
  //var bindings = [];

  parseShapesToObjects(shapes, classesByIri, propertiesById, false)
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

// Saveido klases un propertijus no shapes quad saraksta
// TODO: formalizēt shacl klases un propertijus ar konkrētām JS klasēm, nevis dinamiskām klasēm
function parseShapesToObjects(shapes, classesByIriOUT, propertiesByIdOUT, print = true) {
  if (!shapes?._quads) {
    return
  }
  if (!classesByIriOUT || !propertiesByIdOUT) {
    throw new Error('OUT parameters must not be empty!')
  }

  for (let quadArr of shapes._quads) {
    let quad = quadArr[1]

    let obj = '_'
    let pred = '_'
    let subj = '_'

    try {
      obj = getValueFromQuadPart(quad.object)
      pred = getValueFromQuadPart(quad.predicate)
      subj = getValueFromQuadPart(quad.subject)
    } catch (error) {
      throw new Error(`Neizdevas izgut datus no quad.\n ${obj} => ${pred} => ${subj}`)
    }

    if (subj.indexOf('leaderGovernmentAgencyShapeProperty') !== -1) {
      console.log('aa');
    }

    if (getIriName(pred) === 'property') {
      //Property binding to class
      let propId = obj
      let classIri = subj

      propertiesByIdOUT[propId] = propertiesByIdOUT[propId] ?? { id: propId }
      let shaclProp = propertiesByIdOUT[propId]

      let shaclClass = classesByIriOUT[classIri]
      if (!shaclClass) {
        shaclClass = { iri: classIri, shaclProps: [shaclProp] }
        classesByIriOUT[classIri] = shaclClass
      } else {
        shaclClass.shaclProps.push(shaclProp)
      }

      //if (!shaclProp.shaclClass) {
        shaclProp.shaclClass = shaclClass
      //} else {
        //shaclProp.shaclClasses = shaclProp.shaclClasses || [shaclProp.shaclClass]
        //shaclProp.shaclClasses.push(shaclClass)
      //}
    } else if (isPropertyIdFn(subj)) {
      //Property
      let propValue = obj
      let propName = getIriName(pred)
      let propId = subj

      propertiesByIdOUT[propId] = propertiesByIdOUT[propId] ?? { id: propId }
      propertiesByIdOUT[propId][propName] = propValue
    } else {
      //Class attribute
      let attrValue = obj
      let attrName = getIriName(pred)
      let classIri = subj

      if (classIri.toLowerCase().indexOf('property') !== -1) {
        //console.log('got em');
      }

      classesByIriOUT[classIri] = classesByIriOUT[classIri] ?? { iri: classIri, shaclProps: [] }
      classesByIriOUT[classIri][attrName] = attrValue
      classesByIriOUT[classIri].name = getIriName(classIri)
    }

    if (print) {
      console.log(`${obj} => ${pred} => ${subj}`)
    }
  }

  processPropertyObjects(classesByIriOUT, propertiesByIdOUT)
  processOrFields(propertiesByIdOUT)
}

//Ja propertiji ir nodefinēti kā atsevišķas klases, atrodam tos un pārvietojam no classesByIri uz propertiesByIri
function processPropertyObjects(classesByIri, propertiesByIri) {
  for (let classIri in classesByIri) {
    let type = ''
    if (classesByIri[classIri].type) {
      type = getIriName(classesByIri[classIri].type)
    }

    //Ja starp klasēm ir nokļuvusi propertija, pārkopējam pie propertijām un izdzēšam no klasēm
    if (type === 'PropertyShape') {
      let property = propertiesByIri[classIri]
      if (!property) {
        property = propertiesByIri[classIri] = { iri: classIri }
      }

      for (let classProp in classesByIri[classIri]) {
        property[classProp] = classesByIri[classIri][classProp]
      }

      delete classesByIri[classIri]
    }
  }
}

//Pastrādā propertijiem OR laukus
//Precīzāk - saskaita entites kopā un izvelk ārā; Izvelk ārā kopīgos laukus 
function processOrFields(propertiesById) {
  for (let id in propertiesById) {
    let prop = propertiesById[id]
    if (prop.or) {
      let newProps
      let propInList = propertiesById[prop.or]
      do {
        let orNode = propertiesById[propInList.first]

        if (!newProps) {    //pirmā cikla iterācija
          newProps = orNode
        } else {
          let newPropsTemp = {}
          for (let key in orNode) {
            if (key.toLowerCase() === 'entities') {
              //skaitām kopā entities
              const currentCount = Number(newProps.entities ?? '0')
              const newCount = Number(orNode[key] ?? '0')
              newPropsTemp.entities = (currentCount + newCount).toString()
            } else if (Object.keys(newProps).indexOf(key) !== -1 && newProps[key] === orNode[key]) {
              //atstājam tikai tos propertijus, kas atkārtojas
              newPropsTemp[key] = newProps[key]
            }
          }
          newProps = newPropsTemp
        }

        propInList = propertiesById[propInList.rest]
      } while (propInList)

      //uzstādām jaunos laukus
      for (let key in newProps) {
        if (prop[key]) {
          throw new Error('Ar OR izteiksmi tiek pārrakstīts jau esošs lauks ' + key)
        }

        prop[key] = newProps[key]
      }
    }
  }
}

//Ievieto saveidotos shacl objektus ViziQuer DB
async function pushShaclToViziquerDb(classesByIri, propertiesById) {
  //let dbSchema = 'mini_university'
  let dbSchema = 'dbpedia_shacl'
  let cnt = 1

  //TODO: transakcijas
  await pushShaclToClasses(classesByIri, dbSchema, cnt)
  await pushShaclToProperties(propertiesById, dbSchema, cnt)
  await pushShaclToCpRels(propertiesById, dbSchema, cnt)
}

async function pushShaclToClasses(classesByIri, dbSchema, cnt) {
  let classIris = await db.manyOrNone(`SELECT id, iri FROM ${dbSchema}.classes`)
  let existingClassIris = (classIris ?? []).map(c => c.iri)

  for (let iri in classesByIri) {
    let shaclClass = classesByIri[iri]

    if (existingClassIris.indexOf(iri) !== -1) {
      shaclClass.dbId = classIris.find(c => c.iri === iri).id
      continue
    }

    if (!shaclClass.targetClass) {
      throw new Error("Jābūt aizpildītam targetClass")
    }

    cnt = Number(shaclClass.entities ?? cnt.toString())

    //TODO: SQL injection & ORM?
    //TODO: dynamicly add namespaces
    let classId = (await db.one(`INSERT INTO ${dbSchema}.classes (
      iri,
      cnt,
      props_in_schema,
      ns_id,
      local_name,
      display_name,
      classification_property,
      is_literal,
      indirect_members,
      is_unique,
      hide_in_main,
      self_cp_rels,
      cp_ask_endpoint)
    OVERRIDING SYSTEM VALUE
    VALUES (
      $1,
      $2,
      true,
      10,
      $3,
      $4,
      $5,
      null,
      false,
      false,
      false,
      true,
      false)
    RETURNING id`,
    [
      //iri,
      shaclClass.targetClass,
      cnt,
      getIriName(shaclClass.targetClass),
      getIriName(shaclClass.targetClass),
      //getIriName(shaclClass.name),
      //getIriName(shaclClass.name)
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
    ])).id

    shaclClass.dbId = classId
  }
}

async function pushShaclToProperties(propertiesById, dbSchema, cnt) {
  let propertyIris = await db.manyOrNone(`SELECT id, iri FROM ${dbSchema}.properties`)
  let existingPropertyPaths = (propertyIris ?? []).map(p => p.iri)

  for (let id in propertiesById) {
    let prop = propertiesById[id]

    if (prop.path && existingPropertyPaths.indexOf(prop.path) === -1) {
      let iri = getIriName(prop.path)
      let propertyId

      cnt = Number(prop.entities ?? cnt.toString())

      try {
      //TODO: SQL injection & ORM?
      //TODO: dynamicly add namespaces
      propertyId = (await db.one(`INSERT INTO ${dbSchema}.properties (
        iri,
        cnt,
        ns_id,
        display_name,
        local_name,
        is_unique,
        object_cnt,
        max_cardinality,
        inverse_max_cardinality,
        source_cover_complete,
        target_cover_complete,
        domain_class_id,
        range_class_id,
        classes_in_schema,
        is_classifier,
        props_in_schema,
        pp_ask_endpoint,
        pc_ask_endpoint)
      OVERRIDING SYSTEM VALUE
      VALUES (
        $1,
        $2,
        10,
        $3,
        $4,
        false,
        $5,
        1,
        1,
        true,
        true,
        $6,
        null,
        true,
        false,
        true,
        false,
        false)
      RETURNING id`,
      [
        prop.path,
        cnt,
        getIriName(iri),
        getIriName(iri),
        1,//cnt,    TODO!
        prop.shaclClass.dbId
      ])).id
      } catch (error) {
        console.log('sup')
      }

      prop.dbId = propertyId

      existingPropertyPaths.push(prop.path)
      propertyIris.push({ id: propertyId, iri: prop.path })
    } else if (existingPropertyPaths.indexOf(prop.path) !== -1) {
      try {
        prop.dbId = propertyIris.find(p => p.iri === prop.path).id
      } catch (e) {
        console.log(e)
      }
    }
  }
}

async function pushShaclToCpRels(propertiesById, dbSchema, cnt) {
  for (let id in propertiesById) {
    let prop = propertiesById[id]

    //TODO!
    //cnt = Number(prop.entities ?? cnt.toString())

    if (prop.path) {
      let isOutgoing = true

      //TODO: SQL injection & ORM?
      //TODO: dynamicly add namespaces
      let cpRelId = (await db.one(`INSERT INTO ${dbSchema}.cp_rels (
        class_id,
        property_id,
        type_id,
        cnt,
        object_cnt,
        max_cardinality,
        min_cardinality,
        cover_set_index,
        add_link_slots,
        details_level,
        sub_cover_complete,
        data_cnt)
      OVERRIDING SYSTEM VALUE
      VALUES (
        $1,
        $2,
        ${isOutgoing ? 2 : 1},
        $3,
        $4,
        $5,
        $6,
        0,
        1,
        2,
        true,
        $7)
      RETURNING id`,
      [
        prop.shaclClass.dbId,
        prop.dbId,
        cnt,
        cnt,
        prop.maxCount === '*' ? -1 : prop.maxCount,
        prop.minCount === '*' ? -1 : prop.minCount,
        cnt
      ])).id

      // if (prop.node) {
      //   //TODO: implementēt šo. prop satur node OR datatype
      //   continue
      // }

      // //TEMP!! Šo vajadzētu nolasīt un atjaunot DB pusē
      // let datatypeToIdMapping = {
      //   'http://www.w3.org/2001/XMLSchema#string': 1,
      //   'http://www.w3.org/2001/XMLSchema#integer': 2,
      //   'http://www.w3.org/2001/XMLSchema#dateTime': 3
      // }
      // let datatypeId = datatypeToIdMapping[prop.datatype]

      //TODO: SQL injection & ORM?
      //TODO: dynamicly add namespaces
      // let cpdRelId = (await db.one(`INSERT INTO ${dbSchema}.cpd_rels (
      //   cp_rel_id,
      //   datatype_id,
      //   cnt)
      // OVERRIDING SYSTEM VALUE
      // VALUES (
      //   $1,
      //   $2,
      //   $3)
      // RETURNING id`,
      // [
      //   cpRelId,
      //   datatypeId,
      //   cnt
      // ])).id;
    }
  }
}

async function pushShaclToCpdRels(propertiesById) {
  let existingPropertyPaths = []

  for (let id in propertiesById) {
    let prop = propertiesById[id]

    if (prop.path && existingPropertyPaths.indexOf(prop.path) === -1) {
      if (prop.node) {
        //TODO: implementēt šo. prop satur node OR datatype
        continue
      }

      //TEMP!! Šo vajadzētu nolasīt un atjaunot DB pusē
      let datatypeToIdMapping = {
        'http://www.w3.org/2001/XMLSchema#string': 1,
        'http://www.w3.org/2001/XMLSchema#integer': 2,
        'http://www.w3.org/2001/XMLSchema#dateTime': 3
      }
      let datatypeId = datatypeToIdMapping[prop.datatype]

      //TODO: SQL injection & ORM?
      //TODO: dynamicly add namespaces
      // let cpdRelId = (await db.one(`INSERT INTO ${dbSchema}.cpd_rels (
      //   cp_rel_id,
      //   datatype_id,
      //   cnt)
      // OVERRIDING SYSTEM VALUE
      // VALUES (
      //   $1,
      //   $2,
      //   $3)
      // RETURNING id`,
      // [
      //   cpRelId,
      //   datatypeId,
      //   cnt
      // ])).id;
    }
  }
}




////UTIL FUNCTIONS////

function getValueFromQuadPart(quadPart) {
  let value = quadPart?.value
  //let value = quadPart?.datatype?.value ?? quadPart?.value;
  if (!value) {
    throw new Error('Nav vertibas')
  }
  return /* to the shadows, Flame of Udun! */ value
}

function isPropertyIdFn(text) {
  return /^b\d+$/.test(text)
}

function getIriName(iri) {
  if (iri.indexOf('#') !== -1) {
    return iri.split('#').at(-1)
  } else {
    return iri.split('/').at(-1)
  }
}
//let getUrlFragment = url => url.split("#").at(-1);

main()
