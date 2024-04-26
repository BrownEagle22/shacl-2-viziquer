import rdf from '@zazuko/env-node'
import { getIriName, isPropertyIdFn } from "../utils.js";
import _ from 'lodash'



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
            //Property field
            let propertyFieldValue = object
            let propertyFieldName = getIriName(predicate)
            let propertyId = subject

            let property = shaclPropertyCollection.getOrCreateProperty(propertyId)
            property[propertyFieldName] = propertyFieldValue
        } else {
            //Class field
            let classFieldValue = object
            let classFieldName = getIriName(predicate)
            let classIri = subject

            if (classIri.toLowerCase().indexOf('property') !== -1) {
            //console.log('got em');
            }

            let shaclClass = shaclClassCollection.getOrCreateClass(classIri)
            if (classFieldName === 'targetClass') {
                shaclClass.targetClassList.push(classFieldValue)
            } else {
                shaclClass[classFieldName] = classFieldValue
            }
        }

        if (print) {
            console.log(`${object} => ${predicate} => ${subject}`)
        }
    }
    
    processPropertyObjects(shaclClassCollection, shaclPropertyCollection)
    processOrFieldCollection(shaclClassCollection, shaclPropertyCollection)

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
function processOrFieldCollection(shaclClassCollection, shaclPropertyCollection) {
    for (let shaclProperty of shaclPropertyCollection.getAllProperties()) {
        if (shaclProperty.path === 'http://dbpedia.org/ontology/country') {
            console.log(shaclProperty.path)
        }

        if (shaclProperty.or) {
            processOrField(shaclProperty, shaclPropertyCollection, shaclClassCollection)
        }
    }
}

function processOrField(shaclProperty, shaclPropertyCollection, shaclClassCollection) {
    let commonFields
    let orChainItem = shaclPropertyCollection.getProperty(shaclProperty.or)
    do {
        let orNode = shaclPropertyCollection.getPropertyRaw(orChainItem.first)

        if (!commonFields) {    //pirmā cikla iterācija
            commonFields = JSON.parse(JSON.stringify(orNode))
            commonFields.entities = '0'
        }
        
        commonFields = processOrNode(orNode, commonFields, shaclClassCollection)

        orChainItem = shaclPropertyCollection.getProperty(orChainItem.rest)
    } while (orChainItem)

    //uzstādām jaunos laukus
    for (let fieldKey in commonFields) {
        if (_.isEmpty(shaclProperty[fieldKey])) {
            shaclProperty[fieldKey] = commonFields[fieldKey]   
        } else {
            throw new Error('Ar OR izteiksmi tiek pārrakstīts jau esošs lauks ' + fieldKey)
        }
    }
}

//commonFields laukiem uztaisa šķēlumu ar orNode laukiem. 'entities' ir īpašais gadījums
function processOrNode(orNode, commonFields, shaclClassCollection) {
    let commonFieldsNew = {
        //izņēmumi
        entities: commonFields.entities,
        rdfValueClasses: commonFields.rdfValueClasses
    }

    for (let fieldKey in orNode) {
        const fieldValue = orNode[fieldKey]

        if (fieldKey.toLowerCase() === 'entities') {
            //skaitām kopā entities
            const currentCount = Number(commonFields.entities ?? '0')
            const newCount = Number(fieldValue ?? '0')
            commonFieldsNew.entities = (currentCount + newCount).toString()
        } else if (fieldKey.toLowerCase() === 'class') {
            //akumulējam, nevis ņemam unikālo
            const shaclClass = shaclClassCollection.getClassByTargetClass(fieldValue)
            if (!shaclClass) {
                console.log(`Nav atrasta klase pēc iri "${fieldValue}". Apstrādājot OR izteiksmi, lauks "${fieldKey}=${fieldValue}"`)
            } else {
                commonFieldsNew.rdfValueClasses = commonFields.rdfValueClasses || []
                commonFieldsNew.rdfValueClasses.push(shaclClass)
            }
        } else if (Object.keys(commonFields).indexOf(fieldKey) !== -1 && commonFields[fieldKey] === fieldValue) {
            //atstājam tikai tos propertijus, kas pilnībā atkārtojas
            commonFieldsNew[fieldKey] = commonFields[fieldKey]
        } else {
            console.log(`tiek izlaists lauks "${fieldKey}=${fieldValue}" OR izteiksmē. šobrīd netiek atbalstīts"`)
            //šādi vēl netiek apstrādāti
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

    getClassByTargetClass(targetClass) {
        return Object.values(this.classesByIri).find(c => c.targetClassList.indexOf(targetClass) !== -1)
    }

    removeClass(classIri) {
        delete this.classesByIri[classIri]
    }
}

class ShaclClass {
    dbIdList
    
    iri
    name
    shaclProperties
    
    targetClassList     //Šis nedaudz pārveidots - uz masīvu
    // + citi lauki no SHACL faila...

    constructor(iri) {
        this.dbIdList = []
        this.iri = iri
        this.shaclProperties = []
        this.name = getIriName(iri)
        this.targetClassList = []
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

    getPropertyRaw(propertyId) {
        return this.getProperty(propertyId).getRaw();
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

    rdfValueClasses      //shacl#class vērtības
    // + citi lauki no SHACL faila...

    constructor(id) {
        this.id = id
        this.shaclClasses = []
        this.rdfValueClasses = []
    }

    pushShaclClass(shaclClass) {
        this.shaclClasses.push(shaclClass)

        if (this.shaclClasses.length === 1) {
            this.shaclDomainClass = shaclClass
        } else {
            delete this.shaclDomainClass
        }
    }

    // atstāj tikai SHACL failā norādītos laukus, nevis šeit custom veidotos
    getRaw() {
        let prop = JSON.parse(JSON.stringify(this))
        
        delete prop.id
        delete prop.shaclDomainClass
        delete prop.shaclClasses
        delete prop.rdfValueClasses

        return prop
    }
}

export { parseFileToObjects }