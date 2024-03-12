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



export default class ShaclParser {

}