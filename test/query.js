import {test, assertEquals, assertThrows} from './_helpers.js';
import {DB} from '../dist/index.js';

function roundTripValues(values) {
  const db = new DB();
  db.execute(
    "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, datum ANY)",
  );

  for (const value of values) {
    db.query("INSERT INTO test (datum) VALUES (?)", [value]);
  }

  return db
    .queryEntries("SELECT datum FROM test")
    .map(({ datum }) => datum);
}

test("bind string values", function () {
  const values = ["Hello World!", "I love Deno.", "Täst strüng..."];
  assertEquals(values, roundTripValues(values));
});

test("bind integer values", function () {
  const values = [42, 1, 2, 3, 4, 3453246, 4536787093, 45536787093];
  assertEquals(values, roundTripValues(values));
});

test("bind float values", function () {
  const values = [42.1, 1.235, 2.999, 1 / 3, 4.2345, 345.3246, 4536787.953e-8];
  assertEquals(values, roundTripValues(values));
});

test("bind boolean values", function () {
  assertEquals([1, 0], roundTripValues([true, false]));
});

test("bind date values", function () {
  const values = [new Date(), new Date("2018-11-20"), new Date(123456789)];
  assertEquals(
    values.map((date) => date.toISOString()),
    roundTripValues(values),
  );
});

test("bind blob values", function () {
  const values = [
    new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]),
    new Uint8Array([3, 57, 45]),
  ];
  assertEquals(values, roundTripValues(values));
});

test("blobs are copies", function () {
  const db = new DB();

  db.query(
    "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, val BLOB)",
  );
  const data = new Uint8Array([1, 2, 3, 4, 5]);
  db.query("INSERT INTO test (val) VALUES (?)", [data]);

  const [[a]] = db.query("SELECT val FROM test");
  const [[b]] = db.query("SELECT val FROM test");

  assertEquals(data, a);
  assertEquals(data, b);
  assertEquals(a, b);

  a[0] = 100;
  assertEquals(a[0], 100);
  assertEquals(b[0], 1);
  assertEquals(data[0], 1);

  data[0] = 5;
  const [[c]] = db.query("SELECT val FROM test");
  assertEquals(c[0], 1);
});

test("bind bigint values", function () {
  assertEquals(
    [9007199254741991n, -9007199254741991n, 100],
    roundTripValues([9007199254741991n, -9007199254741991n, 100n]),
  );
});

test("bind null / undefined", function () {
  assertEquals([null, null], roundTripValues([null, undefined]));
});

test("bind mixed values", function () {
  const values = [42, "Hello World!", 0.33333, null];
  assertEquals(values, roundTripValues(values));
});

test("omitting a value binds NULL", function () {
  const db = new DB();
  db.execute("CREATE TABLE test (id INTEGER PRIMARY KEY, datum ANY)");

  const insert = db.prepareQuery(
    "INSERT INTO test (datum) VALUES (?) RETURNING datum",
  );

  assertEquals([null], insert.first());
  assertEquals([null], insert.first([]));
  assertEquals([null], insert.first({}));

  // previously bound values are cleared
  insert.execute(["this is not null"]);
  assertEquals([null], insert.first());
});

test("prepared query clears bindings before reused", function () {
  const db = new DB();
  db.query("CREATE TABLE test (id INTEGER PRIMARY KEY, value INTEGER)");

  const query = db.prepareQuery("INSERT INTO test (value) VALUES (?)");
  query.execute([1]);
  query.execute();

  assertEquals([[1], [null]], db.query("SELECT value FROM test"));

  query.finalize();
  db.close();
});

test("bind very large floating point numbers", function () {
  const db = new DB();

  db.query("CREATE TABLE numbers (id INTEGER PRIMARY KEY, number REAL)");

  db.query("INSERT INTO numbers (number) VALUES (?)", [+Infinity]);
  db.query("INSERT INTO numbers (number) VALUES (?)", [-Infinity]);
  db.query("INSERT INTO numbers (number) VALUES (?)", [+20e20]);
  db.query("INSERT INTO numbers (number) VALUES (?)", [-20e20]);

  const [
    [positiveInfinity],
    [negativeInfinity],
    [positiveTwentyTwenty],
    [negativeTwentyTwenty],
  ] = db.query("SELECT number FROM numbers");

  assertEquals(negativeInfinity, -Infinity);
  assertEquals(positiveInfinity, +Infinity);
  assertEquals(positiveTwentyTwenty, +20e20);
  assertEquals(negativeTwentyTwenty, -20e20);
});

test("big very large integers", function () {
  const db = new DB();
  db.query(
    "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, val INTEGER)",
  );

  const goodValues = [
    0n,
    42n,
    -42n,
    9223372036854775807n,
    -9223372036854775808n,
  ];
  const overflowValues = [
    9223372036854775807n + 1n,
    -9223372036854775808n - 1n,
    2352359223372036854775807n,
    -32453249223372036854775807n,
  ];

  const query = db.prepareQuery("INSERT INTO test (val) VALUES (?)");
  for (const val of goodValues) {
    query.execute([val]);
  }

  const dbValues = db.query(
    "SELECT val FROM test ORDER BY id",
  ).map((
    [id],
  ) => BigInt(id));
  assertEquals(goodValues, dbValues);

  for (const bigVal of overflowValues) {
    assertThrows(() => {
      query.execute([bigVal]);
    });
  }

  query.finalize();
  db.close();
});

test("bind named parameters", function () {
  const db = new DB();

  db.query(
    "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, val TEXT)",
  );

  // :name
  db.query("INSERT INTO test (val) VALUES (:val)", { val: "value" });
  db.query(
    "INSERT INTO test (val) VALUES (:otherVal)",
    { otherVal: "value other" },
  );
  db.query(
    "INSERT INTO test (val) VALUES (:explicitColon)",
    { ":explicitColon": "value explicit" },
  );

  // @name
  db.query(
    "INSERT INTO test (val) VALUES (@someName)",
    { "@someName": "@value" },
  );

  // $name
  db.query(
    "INSERT INTO test (val) VALUES ($var::Name)",
    { "$var::Name": "$value" },
  );

  // explicit positional syntax
  db.query("INSERT INTO test (id, val) VALUES (?2, ?1)", ["this-is-it", 1000]);

  // names must exist
  assertThrows(() => {
    db.query(
      "INSERT INTO test (val) VALUES (:val)",
      { Val: "miss-spelled name" },
    );
  });

  // make sure the data came through correctly
  const vals = [...db.query("SELECT val FROM test ORDER BY id ASC")]
    .map(([datum]) => datum);
  assertEquals(
    vals,
    [
      "value",
      "value other",
      "value explicit",
      "@value",
      "$value",
      "this-is-it",
    ],
  );
});

test("iterate from prepared query", function () {
  const db = new DB();
  db.execute("CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT)");
  db.execute("INSERT INTO test (id) VALUES (1), (2), (3)");

  const res = [];
  const query = db.prepareQuery("SELECT id FROM test");
  for (const [id] of query.iter()) {
    res.push(id);
  }
  assertEquals(res, [1, 2, 3]);

  query.finalize();
  db.close();
});

test("query all from prepared query", function () {
  const db = new DB();
  db.query("CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT)");
  const query = db.prepareQuery("SELECT id FROM test");

  assertEquals(query.all(), []);
  db.query("INSERT INTO test (id) VALUES (1), (2), (3)");
  assertEquals(query.all(), [[1], [2], [3]]);

  query.finalize();
  db.close();
});

test("query first from prepared query", function () {
  const db = new DB();
  db.query("CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT)");
  db.query("INSERT INTO test (id) VALUES (1), (2), (3)");

  const querySingle = db.prepareQuery("SELECT id FROM test WHERE id = ?");
  assertEquals(querySingle.first([42]), undefined);
  assertEquals(querySingle.first([2]), [2]);

  const queryAll = db.prepareQuery("SELECT id FROM test ORDER BY id ASC");
  assertEquals(queryAll.first(), [1]);

  querySingle.finalize();
  queryAll.finalize();
  db.close();
});

test("query one from prepared query", function () {
  const db = new DB();
  db.query("CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT)");
  db.query("INSERT INTO test (id) VALUES (1), (2), (3)");

  const queryOne = db.prepareQuery(
    "SELECT id FROM test WHERE id = ?",
  );
  assertThrows(() => queryOne.one([42]));
  assertEquals(queryOne.one([2]), [2]);

  const queryAll = db.prepareQuery("SELECT id FROM test");
  assertThrows(() => queryAll.one());

  queryOne.finalize();
  queryAll.finalize();
  db.close();
});

test("execute from prepared query", function () {
  const db = new DB();
  db.query("CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT)");

  const insert = db.prepareQuery("INSERT INTO test (id) VALUES (:id)");
  for (const id of [1, 2, 3]) {
    insert.execute({ id });
  }
  insert.finalize();
  assertEquals(db.query("SELECT id FROM test"), [[1], [2], [3]]);

  db.close();
});

test("empty query returns empty array", function () {
  const db = new DB();
  db.query("CREATE TABLE test (id INTEGER PRIMARY KEY)");
  assertEquals([], db.query("SELECT * FROM test"));
  db.close();
});

test("query entries returns correct object shapes", function () {
  const db = new DB();
  db.query(
    "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, height REAL)",
  );

  const rowsOrig = [
    { id: 1, name: "Peter Parker", height: 1.5 },
    { id: 2, name: "Clark Kent", height: 1.9 },
    { id: 3, name: "Robert Paar", height: 2.1 },
  ];

  const insertQuery = db.prepareQuery(
    "INSERT INTO test (id, name, height) VALUES (:id, :name, :height)",
  );
  for (const row of rowsOrig) {
    insertQuery.execute(row);
  }
  insertQuery.finalize();

  const query = db.prepareQuery("SELECT * FROM test");
  assertEquals(rowsOrig, [...query.iterEntries()]);
  assertEquals(rowsOrig, query.allEntries());
  assertEquals(rowsOrig[0], query.firstEntry());
  assertEquals(rowsOrig, db.queryEntries("SELECT * FROM test"));

  query.finalize();
  db.close();
});

test("prepared query can be reused", function () {
  const db = new DB();
  db.query("CREATE TABLE test (id INTEGER PRIMARY KEY)");

  const query = db.prepareQuery("INSERT INTO test (id) VALUES (?)");
  query.execute([1]);
  query.execute([2]);
  query.execute([3]);

  assertEquals([[1], [2], [3]], db.query("SELECT id FROM test"));

  query.finalize();
  db.close();
});

test("get columns from select query", function () {
  const db = new DB();

  db.query(
    "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)",
  );

  const query = db.prepareQuery("SELECT id, name from test");

  assertEquals(query.columns(), [
    { name: "id", originName: "id", tableName: "test" },
    { name: "name", originName: "name", tableName: "test" },
  ]);
});

test("get columns from returning query", function () {
  const db = new DB();

  db.query(
    "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)",
  );
  const query = db.prepareQuery(
    "INSERT INTO test (name) VALUES (?) RETURNING *",
  );

  assertEquals(query.columns(), [
    { name: "id", originName: "id", tableName: "test" },
    { name: "name", originName: "name", tableName: "test" },
  ]);

  assertEquals(query.all(["name"]), [[1, "name"]]);
});

test("get columns with renamed column", function () {
  const db = new DB();

  db.query(
    "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)",
  );
  db.query("INSERT INTO test (name) VALUES (?)", ["name"]);

  const query = db.prepareQuery(
    "SELECT id AS test_id, name AS test_name from test",
  );
  const columns = query.columns();

  assertEquals(columns, [
    { name: "test_id", originName: "id", tableName: "test" },
    { name: "test_name", originName: "name", tableName: "test" },
  ]);
});

test("columns can be obtained from empty prepared query", function () {
  const db = new DB();
  db.query(
    "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEST, age INTEGER)",
  );
  db.query("INSERT INTO test (name, age) VALUES (?, ?)", ["Peter Parker", 21]);

  const query = db.prepareQuery("SELECT * FROM test");
  const columnsFromPreparedQuery = query.columns();
  query.finalize();

  const queryEmpty = db.prepareQuery("SELECT * FROM test WHERE 1 = 0");
  const columnsFromPreparedQueryWithEmptyQuery = queryEmpty.columns();
  assertEquals(queryEmpty.all(), []);
  query.finalize();

  assertEquals(
    [{ name: "id", originName: "id", tableName: "test" }, {
      name: "name",
      originName: "name",
      tableName: "test",
    }, { name: "age", originName: "age", tableName: "test" }],
    columnsFromPreparedQuery,
  );
  assertEquals(
    columnsFromPreparedQueryWithEmptyQuery,
    columnsFromPreparedQuery,
  );
});

test("invalid number of bound parameters throws", function () {
  const db = new DB();
  db.execute("CREATE TABLE test (id INTEGER PRIMARY KEY)");

  // too many
  assertThrows(() => {
    db.query("SELECT * FROM test", [null]);
  });
  assertThrows(() => {
    db.query("SELECT * FROM test LIMIT ?", [5, "extra"]);
  });

  // too few
  assertThrows(() => db.query("SELECT * FROM test LIMIT ?", []));
  assertThrows(() => {
    db.query(
      "SELECT * FROM test WHERE id >= ? AND id <= ? LIMIT ?",
      [42],
    );
  });
});

test("using finalized prepared query throws", function () {
  const db = new DB();
  db.query("CREATE TABLE test (name TEXT)");
  const query = db.prepareQuery("INSERT INTO test (name) VALUES (?)");
  query.finalize();

  assertThrows(() => query.execute(["test"]));
  db.close();
});

test("invalid binding throws", function () {
  const db = new DB();
  db.query("CREATE TABLE test (id INTEGER)");
  assertThrows(() => {
    // deno-lint-ignore no-explicit-any
    const badBinding = [{}];
    db.query("SELECT * FORM test WHERE id = ?", badBinding);
  });
  db.close();
});

test("get columns from finalized query throws", function () {
  const db = new DB();

  db.query("CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT)");

  const query = db.prepareQuery("SELECT id from test");
  query.finalize();

  // after iteration is done
  assertThrows(() => {
    query.columns();
  });
});

test("introspect SQL for prepared queries", function () {
  const db = new DB();
  db.query(
    "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, balance INTEGER)",
  );

  const query = db.prepareQuery(
    "INSERT INTO test (name, balance) VALUES (:name, :balance)",
  );

  assertEquals(
    query.expandSql(),
    "INSERT INTO test (name, balance) VALUES (NULL, NULL)",
  );
  assertEquals(
    query.expandSql({ name: "Peter Parker", balance: 42 }),
    "INSERT INTO test (name, balance) VALUES ('Peter Parker', 42)",
  );
  assertEquals(
    query.expandSql({
      name: new Uint8Array(2),
      balance: new Date(0),
    }),
    "INSERT INTO test (name, balance) VALUES (x'0000', '1970-01-01T00:00:00.000Z')",
  );

  query.finalize();
  db.close();
});
