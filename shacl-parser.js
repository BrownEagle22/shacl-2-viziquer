//THIS FILE IS WIP AND UNUSED !!

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

async function parseShaclFile(filepathTtl) {
    const shapes = await rdf.dataset().import(rdf.fromFile(filepathTtl));

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

export {
    parseShapesToObjects
};