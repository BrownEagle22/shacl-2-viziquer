import fs from 'fs'
import _ from 'lodash'

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function getIriName(iri) {
  if (iri.indexOf('#') !== -1) {
    return iri.split('#').at(-1)
  } else {
    return iri.split('/').at(-1)
  }
}

function isPropertyIdFn(text) {
  return /^b\d+$/.test(text)
}

function getNamespace(iri) {
  if (iri.indexOf('#') !== -1) {
    return iri.split('#')[0]
  } else {
    return iri.substr(0, iri.lastIndexOf('/'));
  }
}

function printNamespaces(shaclPath) {
  let shaclText;

  try {
    shaclText = fs.readFileSync(shaclPath, 'utf8')
    //console.log(data)
  } catch (err) {
    console.error('Error reading file:', err)
  }

  let namespaces = []

  const regex = /<(http[^>]*)>/g
  let matchesIt = shaclText.matchAll(regex)
  namespaces = [...matchesIt].map(x => getNamespace(x[1]))

  let namespaceGrouped = _.groupBy(namespaces, n => n)

  let namespacesToPut = []

  for (let key in namespaceGrouped) {
    if (namespaceGrouped[key].length > 1) {
      namespacesToPut.push({ name: key, count: namespaceGrouped[key].length })
    }
  }

  for (let idx in namespacesToPut) {
    const namespace = namespacesToPut[idx]
    console.log(`(skaits: ${namespace.count}): ${namespace.name}`)
  }
}

export { getIriName, isPropertyIdFn, printNamespaces }
// export function prefixNamespaces(shaclPath, prefixNamespacePairs) {
//   let shaclText;

//   try {
//     shaclText = fs.readFileSync(shaclPath, 'utf8')
//     console.log(data)
//   } catch (err) {
//     console.error('Error reading file:', err)
//   }
  
//   for (let pair of prefixNamespacePairs) {
//     const pattern = escapeRegExp(pair.namespace)
//     const regexp = new RegExp(`<${pattern}>`, 'g')
//     shaclText = shaclText.replace(regex, pair.prefix)
//   }
//   shaclText.replace

//   let namespaces = []

//   const regex = /<(http[^>]*)>/g
//   let matchesIt = shaclText.matchAll(regex)
//   namespaces = [...matchesIt].map(x => getNamespace(x[1]))

//   let namespaceGrouped = _.groupBy(namespaces, n => n)

//   let namespacesToPut = []

//   for (let key in namespaceGrouped) {
//     if (namespaceGrouped[key].length > 1) {
//       namespacesToPut.push({ name: key, count: namespaceGrouped[key].length })
//     }
//   }

//   for (let idx in namespacesToPut) {
//     const namespace = namespacesToPut[idx]
//     console.log(`(skaits: ${namespace.count}): ${namespace.name}`)
//   }
// }