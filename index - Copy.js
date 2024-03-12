import rdf from '@zazuko/env-node'
import SHACLValidator from 'rdf-validate-shacl'

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
  //let shapesfile = "test_SHACL.ttl";
  let shapesfile = "edm_SHACL.ttl";
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

let getValueFromQuadPart = quadPart => {
  let value = quadPart?.value;
  //let value = quadPart?.datatype?.value ?? quadPart?.value;
  if (!value) {
    throw new Error("Nav vertibas");
  }
  return /* to the shadows, Flame of Udun! */ value;
}

let isPropertyIdFn = text => /^b\d+$/.test(text);

let getIriName = iri => iri.split("#").at(-1) ?? iri.split("/").at(-1);
//let getUrlFragment = url => url.split("#").at(-1);

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

    propertiesById[propId] = propertiesById[propId] ?? { id: propId };
    let shaclProp = propertiesById[propId];

    let shaclClass = classesByIri[classIri];
    if (!shaclClass) {
      shaclClass = { iri: classIri, shaclProps: [shaclProp] };
      classesByIri[classIri] = shaclClass;
    } else {
      shaclClass["shaclProps"].push(shaclProp);
    }

    shaclProp["shaclClass"] = shaclClass;
  } else if (isPropertyIdFn(subj)) {
    //Property
    let propValue = getIriName(obj);
    let propName = getIriName(pred);
    let propId = getIriName(subj);

    propertiesById[propId] = propertiesById[propId] ?? { id: propId };
    propertiesById[propId][propName] = propValue;
  } else {
    //Class attribute
    let attrValue = getIriName(obj);
    let attrName = getIriName(pred);
    let classIri = subj;//getUrlFragment(subj);
    
    classesByIri[classIri] = classesByIri[classIri] ?? { iri: classIri, shaclProps: [] };
    classesByIri[classIri][attrName] = attrValue;
    classesByIri["name"] = getIriName(classIri);
  }

  console.log(`${obj} => ${pred} => ${subj}`);
}

for (let iri in classesByIri) {
  let shaclClass = classesByIri[iri];

  //TODO: SQL injection & ORM?
  //TODO: dynamicly add namespaces
  let sql = `
INSERT INTO mini_university.classes (
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
  '${iri}',
  true,
  68,
  '${shaclClass.name}',
  '${shaclClass.name}',
  false,
  false,
  false,
  true,
  false)
`;
  shaclClass.dbId = 1;  //TODO...
}

for (let id in propertiesById) {
  let prop = propertiesById[id];

  if (prop.path) {
    let iri = getIriName(prop.path);
    let sql = `
INSERT INTO mini_university.properties (
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
  ${prop.path},
  68,
  ${iri},
  ${iri},
  false,
  1,
  1,
  true,
  true,
  ${prop.dbId},
  null,
  true,
  false,
  true,
  false,
  false)`;
  }
}



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

main();