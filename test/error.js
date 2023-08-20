import {test, assertEquals, assertInstanceOf, assertThrows} from './_helpers.js';
import {DB, SqliteError, Status} from '../dist/index.js';

test("invalid SQL", function () {
  const db = new DB();
  const queries = [
    "INSERT INTO does_not_exist (balance) VALUES (5)",
    "this is not sql",
    ";;;",
  ];
  for (const query of queries) assertThrows(() => db.query(query));
});

test("constraint error is correct", function () {
  const db = new DB();
  db.query("CREATE TABLE test (name TEXT PRIMARY KEY)");
  db.query("INSERT INTO test (name) VALUES (?)", ["A"]);

  assertThrows(
    () => db.query("INSERT INTO test (name) VALUES (?)", ["A"]),
    (error) => {
      assertInstanceOf(error, SqliteError);
      assertEquals(error.code, Status.SqliteConstraint);
      assertEquals(error.message, "UNIQUE constraint failed: test.name");
    },
  );
});

test("syntax error code is correct", function () {
  const db = new DB();

  assertThrows(
    () => db.query("CREATE TABLEX test (name TEXT PRIMARY KEY)"),
    (error) => {
      assertInstanceOf(error, SqliteError);
      assertEquals(error.code, Status.SqliteError);
      assertEquals(error.message, 'near "TABLEX": syntax error');
    },
  );
});
