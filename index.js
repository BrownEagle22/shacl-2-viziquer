import rdf from '@zazuko/env-node';
import SHACLValidator from 'rdf-validate-shacl';

import 'dotenv/config';

import pgp from 'pg-promise';
import pgUrlParse from 'pg-connection-string';

const pgpOptions = {};
const pgpInstance = pgp(pgpOptions);
const pgUrlParseInstance = pgUrlParse.parse;

const DB_URL = process.env.DB_URL;
const DB_CONFIG = pgUrlParseInstance(DB_URL);
const db = pgpInstance(DB_CONFIG);

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
  let shapesfile = "test_SHACL.ttl";
  //let shapesfile = "edm_SHACL.ttl";
  //let shapesfile = "LUBM_SHACL.ttl";

  const shapes = await rdf.dataset().import(rdf.fromFile(`../../shacl-samples/${shapesfile}`))
  const data = await rdf.dataset().import(rdf.fromFile('../../shacl-samples/test_SHACL_data.ttl'))

  const validator = new SHACLValidator(shapes, { factory: rdf })
  const report = await validator.validate(data)

  //TODO: šos aizpildīt
  let classesByIri = {}
  let propertiesById = {};
  //var classes = [];
  //var properties = [];
  //var bindings = [];

  parseShapesToObjects(shapes, classesByIri, propertiesById);
  await pushShaclToViziquerDb(classesByIri, propertiesById);

  // Check conformance: `true` or `false`
  console.log(report.conforms)

  for (const result of report.results) {
    // See https://www.w3.org/TR/shacl/#results-validation-result for details
    // about each property
    console.log(result.message)
    console.log(result.path)
    console.log(result.focusNode)
    console.log(result.severity)
    console.log(result.sourceConstraintComponent)
    console.log(result.sourceShape)
  }

  // Validation report as RDF dataset
  console.log(await report.dataset.serialize({ format: 'text/n3' }))
}

// Saveido klases un propertijus no shapes quad saraksta
// TODO: formalizēt shacl klases un propertijus ar konkrētām JS klasēm, nevis dinamiskām klasēm
function parseShapesToObjects(shapes, classesByIriOUT, propertiesByIdOUT) {
  if (!shapes?._quads) {
    return;
  }
  if (!classesByIriOUT || !propertiesByIdOUT) {
    throw new Error("OUT parameters must not be empty!");
  }


  for (let quadArr of shapes._quads) {
    let quad = quadArr[1];

    let obj = "_";
    let pred = "_";
    let subj = "_";

    try {
      obj = getValueFromQuadPart(quad.object);
      pred = getValueFromQuadPart(quad.predicate);
      subj = getValueFromQuadPart(quad.subject);
    } catch (error) {
      throw new Error(`Neizdevas izgut datus no quad.\n ${obj} => ${pred} => ${subj}`);
    }

    if (getIriName(pred) == "property") {
      //Property binding to class
      let propId = obj;
      let classIri = subj;

      propertiesByIdOUT[propId] = propertiesByIdOUT[propId] ?? { id: propId };
      let shaclProp = propertiesByIdOUT[propId];

      let shaclClass = classesByIriOUT[classIri];
      if (!shaclClass) {
        shaclClass = { iri: classIri, shaclProps: [shaclProp] };
        classesByIriOUT[classIri] = shaclClass;
      } else {
        shaclClass["shaclProps"].push(shaclProp);
      }

      shaclProp["shaclClass"] = shaclClass;
    } else if (isPropertyIdFn(subj)) {
      //Property
      let propValue = getIriName(obj);
      let propName = getIriName(pred);
      let propId = getIriName(subj);

      if (propName == "path") {
        propValue = obj;
      }

      propertiesByIdOUT[propId] = propertiesByIdOUT[propId] ?? { id: propId };
      propertiesByIdOUT[propId][propName] = propValue;
    } else {
      //Class attribute
      let attrValue = getIriName(obj);
      let attrName = getIriName(pred);
      let classIri = subj;//getUrlFragment(subj);
      
      classesByIriOUT[classIri] = classesByIriOUT[classIri] ?? { iri: classIri, shaclProps: [] };
      classesByIriOUT[classIri][attrName] = attrValue;
      classesByIriOUT[classIri]["name"] = getIriName(classIri);
    }

    console.log(`${obj} => ${pred} => ${subj}`);
  }
}

//Ievieto saveidotos shacl objektus ViziQuer DB
async function pushShaclToViziquerDb(classesByIri, propertiesById) {
  let dbSchema = "mini_university";

  for (let iri in classesByIri) {
    let shaclClass = classesByIri[iri];

    //TODO: SQL injection & ORM?
    //TODO: dynamicly add namespaces
    let classId = (await db.one(`INSERT INTO ${dbSchema}.classes (
      iri,
      props_in_schema,
      ns_id,
      local_name,
      display_name,
      indirect_members,
      is_unique,
      hide_in_main,
      self_cp_rels,
      cp_ask_endpoint)
    VALUES (
      $1,
      true,
      68,
      $2,
      $3,
      false,
      false,
      false,
      true,
      false)
    RETURNING id`,
    [
        iri,
        shaclClass.name,
        shaclClass.name,
    ])).id;

    shaclClass.dbId = classId;
  }

  for (let id in propertiesById) {
    let prop = propertiesById[id];

    if (prop.path) {
      let iri = getIriName(prop.path);

      //TODO: SQL injection & ORM?
      //TODO: dynamicly add namespaces
      let propertyId = (await db.one(`INSERT INTO ${dbSchema}.properties (
        iri,
        ns_id,
        display_name,
        local_name,
        is_unique,
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
      VALUES (
        $1,
        68,
        $2,
        $3,
        false,
        1,
        1,
        true,
        true,
        $4,
        null,
        true,
        false,
        true,
        false,
        false)
      RETURNING id`,
      [
        prop.path,
        iri,
        iri,
        prop.shaclClass.dbId
      ])).id;

      prop.dbId = propertyId;



      let isOutgoing = true;

      //TODO: SQL injection & ORM?
      //TODO: dynamicly add namespaces
      let cpRels = (await db.one(`INSERT INTO ${dbSchema}.cp_rels (
        class_id,
        property_id,
        type_id,
        max_cardinality,
        min_cardinality,
        cover_set_index,
        add_link_slots,
        details_level,
        sub_cover_complete)
      VALUES (
        $1,
        $2,
        ${isOutgoing ? 2 : 1},
        $3,
        $4,
        0,
        1,
        2,
        true)
      RETURNING id`,
      [
        prop.shaclClass.dbId,
        prop.dbId,
        prop.maxCount == "*" ? -1 : prop.maxCount,
        prop.minCount == "*" ? -1 : prop.minCount
      ])).id;
    }
  }
}






////UTIL FUNCTIONS////


function getValueFromQuadPart(quadPart)  {
  let value = quadPart?.value;
  //let value = quadPart?.datatype?.value ?? quadPart?.value;
  if (!value) {
    throw new Error("Nav vertibas");
  }
  return /* to the shadows, Flame of Udun! */ value;
}

function isPropertyIdFn(text) {
  return /^b\d+$/.test(text);
}

function getIriName(iri) {
  return iri.split("#").at(-1) ?? iri.split("/").at(-1);
}
//let getUrlFragment = url => url.split("#").at(-1);






main();