import pgp from 'pg-promise'
import pgUrlParse from 'pg-connection-string'
import { getIriName } from '../utils.js'

const pgpOptions = {}
const pgpInstance = pgp(pgpOptions)
const pgUrlParseInstance = pgUrlParse.parse

const DB_URL = process.env.DB_URL
const DB_SCHEMA = process.env.DB_SCHEMA
const DB_CONFIG = pgUrlParseInstance(DB_URL)
const db = pgpInstance(DB_CONFIG)


//Ievieto saveidotos shacl objektus ViziQuer DB
async function pushShaclToViziquerDb(classesByIri, propertiesById) {
    //let dbSchema = 'mini_university'
    let dbSchema = DB_SCHEMA
    let cnt = 1
  
    //TODO: transakcijas
    await pushShaclToClasses(classesByIri, dbSchema, cnt)
    await pushShaclToProperties(propertiesById, dbSchema, cnt)
    await pushShaclToCpRels(propertiesById, dbSchema, cnt)
    await setRdfType(dbSchema)
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
  
    let duplicatePaths = new Set()

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
                    prop.shaclDomainClass.dbId
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

                duplicatePaths.add(prop.dbId)
            } catch (e) {
                console.log(e)
            }
        }
    }

    if (duplicatePaths.size !== 0) {
        await db.one(`UPDATE ${dbSchema}.properties
            SET domain_class_id = null
            WHERE id in ($1)`,
            [
                Array.from(duplicatePaths).join(',')
            ]
        )
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
                prop.shaclDomainClass.dbId,
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

async function setRdfType(dbSchema) {
    await db.one(`update ${dbSchema}.properties
        set ns_id=1
        where iri = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'`,
        []
    )
}

export { pushShaclToViziquerDb }
