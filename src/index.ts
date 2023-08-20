export {Status} from './constants';
export {DB} from './db';
export {SqliteError} from './error';

export type {SqliteDeserializeOptions, SqliteFunctionOptions, SqliteOptions} from './db';
export type {SqlFunctionArgument, SqlFunctionResult} from './function';
export type {ColumnName, PreparedQuery, QueryParameter, QueryParameterSet, Row, RowObject} from './query';

import {compile} from '../build/sqlite.js';
await compile();
