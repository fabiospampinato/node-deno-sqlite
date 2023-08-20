import benchmark from 'benchloop';
import {DB} from '../dist/index.js';

const db = new DB(':memory:');
const names = "Deno Land Peter Parker Clark Kent Robert Parr".split(" ");

db.query("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, balance INTEGER)");

benchmark({
  name: "insert 10 000 (named)",
  iterations: 10,
  fn: () => {
    const query = db.prepareQuery(
      "INSERT INTO users (name, balance) VALUES (:name, :balance)",
    );
    db.query("begin");
    for (let i = 0; i < 10_000; i++) {
      query.execute({ name: names[i % names.length], balance: i });
    }
    db.query("commit");
  },
});

benchmark({
  name: "insert 10 000 (positional)",
  iterations: 10,
  fn: () => {
    const query = db.prepareQuery(
      "INSERT INTO users (name, balance) VALUES (?, ?)",
    );
    db.query("begin");
    for (let i = 0; i < 10_000; i++) {
      query.execute([names[i % names.length], i]);
    }
    db.query("commit");
  },
});

benchmark({
  name: "select 10 000 (select all)",
  iterations: 10,
  fn: () => {
    db.query(
      "SELECT name, balance FROM users LIMIT 10000",
    );
  },
});

benchmark({
  name: "select 10 000 (select first)",
  iterations: 10,
  fn: () => {
    const query = db.prepareQuery(
      "SELECT name, balance FROM users WHERE id = ?",
    );
    for (let id = 1; id <= 10_000; id++) {
      query.first([id]);
    }
  },
});

benchmark.summary ();
