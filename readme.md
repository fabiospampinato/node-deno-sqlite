# Node Deno SQLite

This is a port of Deno's [`x/sqlite`](https://github.com/dyedgreen/deno-sqlite) for Node, read its [docs](https://deno.land/x/sqlite@v3.7.3/mod.ts).

## Limitations

There are two important limitations for this module that you need to be aware of:

1. No kind of file locking is implemented, so using the same database with more than one instance of sqlite, _in the entire computer_, is unsafe and can lead to database corruptions. This limitation could potentially be lifted in the future.
2. No kind of memory-mapping is supported, as such WAL mode can't really be supported, even if file locking gets implemented in the future.
