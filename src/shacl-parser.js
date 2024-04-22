import rdf from '@zazuko/env-node'
import { getIriName, isPropertyIdFn } from "../utils.js";



async function parseFileToObjects(shaclFilePath, print = true) {
    const shapes = await rdf.dataset().import(rdf.fromFile(shaclFilePath))
    
    return parseShapesToObjects(shapes, print)
}

function parseShapesToObjects(shapes, print = true) {
    let shaclClassCollection = new ShaclClassCollection
    let shaclPropertyCollection = new ShaclPropertyCollection
    
    if (!shapes?._quads) {
        return
    }

    for (let quadArr of shapes._quads) {
        let quad = quadArr[1]

        let object = '_'
        let predicate = '_'
        let subject = '_'

        try {
            object = quad.object.value
            predicate = quad.predicate.value
            subject = quad.subject.value
        } catch (error) {
            throw new Error(`Neizdevas izgut datus no quad.\n ${object} => ${predicate} => ${subject}`)
        }

        // if (subject.indexOf('leaderGovernmentAgencyShapeProperty') !== -1) {
        //     console.log('aa');
        // }

        if (getIriName(predicate) === 'property') {
            //Property binding to class
            let propertyId = object
            let classIri = subject

            let shaclProperty = shaclPropertyCollection.getOrCreateProperty(propertyId)
            let shaclClass = shaclClassCollection.getOrCreateClass(classIri)

            shaclClass.pushShaclProperty(shaclProperty)
            shaclProperty.pushShaclClass(shaclClass)
        } else if (isPropertyIdFn(subject)) {
            //Property
            let propertyFieldValue = object
            let propertyFieldName = getIriName(predicate)
            let propertyId = subject

            shaclPropertyCollection.getOrCreateProperty(propertyId)[propertyFieldName] = propertyFieldValue
        } else {
            //Class attribute
            let classFieldValue = object
            let classFieldName = getIriName(predicate)
            let classIri = subject

            if (classIri.toLowerCase().indexOf('property') !== -1) {
            //console.log('got em');
            }

            shaclClassCollection.getOrCreateClass(classIri)[classFieldName] = classFieldValue
        }

        if (print) {
            console.log(`${object} => ${predicate} => ${subject}`)
        }
    }
    
    processPropertyObjects(shaclClassCollection, shaclPropertyCollection)
    processOrFieldCollection(shaclPropertyCollection)

    return {
        classesByIri: shaclClassCollection.classesByIri,
        propertiesById: shaclPropertyCollection.propertiesById
    }
}

//Ja propertiji ir nodefinēti kā atsevišķas klases, atrodam tos un pārvietojam no classesByIri uz propertiesByIri
function processPropertyObjects(shaclClassCollection, shaclPropertyCollection) {
    for (let classIri in shaclClassCollection.classesByIri) {
        let shaclClass = shaclClassCollection.classesByIri[classIri]

        let classType = ''
        if (shaclClass.type) {
          classType = getIriName(shaclClass.type)
        }
    
        //Ja starp klasēm ir nokļuvusi propertija, pārkopējam pie propertijām un izdzēšam no klasēm
        if (classType === 'PropertyShape') {
            let shaclProperty = shaclPropertyCollection.getOrCreateProperty(classIri)
            
            for (let classFieldName in shaclClass) {
                shaclProperty[classFieldName] = shaclClass[classFieldName]
            }

            shaclClassCollection.removeClass(classIri)
        }
    }
}

//Apstrādā propertijiem OR laukus
//Precīzāk - saskaita entites kopā un izvelk ārā; Izvelk ārā kopīgos laukus 
function processOrFieldCollection(shaclPropertyCollection) {
    for (let shaclProperty of shaclPropertyCollection.getAllProperties()) {
        if (shaclProperty.or) {
            processOrField(shaclProperty, shaclPropertyCollection)
        }
    }
}

function processOrField(shaclProperty, shaclPropertyCollection) {
    let commonFields
    let orChainItem = shaclPropertyCollection.getProperty(shaclProperty.or)
    do {
        let orNode = shaclPropertyCollection.getProperty(orChainItem.first)
        
        delete orNode.shaclDomainClass
        delete orNode.shaclClasses

        if (!commonFields) {    //pirmā cikla iterācija
            commonFields = orNode
        } else {
            commonFields = processOrNode(orNode, commonFields)
        }

        orChainItem = shaclPropertyCollection.getProperty(orChainItem.rest)
    } while (orChainItem)

    //uzstādām jaunos laukus
    for (let fieldKey in commonFields) {
        if (shaclProperty[fieldKey]) {
            throw new Error('Ar OR izteiksmi tiek pārrakstīts jau esošs lauks ' + fieldKey)
        }

        shaclProperty[fieldKey] = commonFields[fieldKey]
    }
}

//commonFields laukiem uztaisa šķēlumu ar orNode laukiem. 'entities' ir īpašais gadījums
function processOrNode(orNode, commonFields) {
    let commonFieldsNew = {}

    for (let fieldKey in orNode) {
        const fieldValue = orNode[fieldKey]

        if (fieldKey.toLowerCase() === 'entities') {
            //skaitām kopā entities
            const currentCount = Number(commonFields.entities ?? '0')
            const newCount = Number(fieldValue ?? '0')
            commonFieldsNew.entities = (currentCount + newCount).toString()
        } else if (Object.keys(commonFields).indexOf(fieldKey) !== -1 && commonFields[fieldKey] === fieldValue) {
            //atstājam tikai tos propertijus, kas pilnībā atkārtojas
            commonFieldsNew[fieldKey] = commonFields[fieldKey]
        }
    }

    return commonFieldsNew
}


class ShaclClassCollection {
    classesByIri

    constructor() {
        this.classesByIri = {}
    }

    getOrCreateClass(classIri) {
        let shaclClass = this.classesByIri[classIri]
        if (!shaclClass) {
          shaclClass = this.classesByIri[classIri] = new ShaclClass(classIri)
        }
        return shaclClass
    }

    removeClass(classIri) {
        delete this.classesByIri[classIri]
    }
}

class ShaclClass {
    iri
    name
    shaclProperties
    // + citi lauki no SHACL faila...

    constructor(iri) {
        this.iri = iri
        this.shaclProperties = []
        this.name = getIriName(iri)
    }

    pushShaclProperty(shaclProperty) {
        this.shaclProperties.push(shaclProperty)
    }
}


class ShaclPropertyCollection {
    propertiesById

    constructor() {
        this.propertiesById = {}
    }

    getOrCreateProperty(propertyId) {
        let shaclProperty = this.getProperty(propertyId)
        if (!shaclProperty) {
            shaclProperty = this.propertiesById[propertyId] = new ShaclProperty(propertyId)
        }
        return shaclProperty
    }

    getProperty(propertyId) {
        return this.propertiesById[propertyId]
    }

    getAllProperties() {
        return Object.values(this.propertiesById)
    }
}

class ShaclProperty {
    id
    shaclDomainClass
    shaclClasses
    // + citi lauki no SHACL faila...

    constructor(id) {
        this.id = id
        this.shaclClasses = []
    }

    pushShaclClass(shaclClass) {
        this.shaclClasses.push(shaclClass)

        if (this.shaclClasses.length === 1) {
            this.shaclDomainClass = shaclClass
        } else {
            delete this.shaclDomainClass
        }
    }
}

export { parseFileToObjects }