# Node Deno SQLite

This is a port of Deno's [`x/sqlite`](https://github.com/dyedgreen/deno-sqlite) for Node, check out their [repo](https://github.com/dyedgreen/deno-sqlite) and [docs](https://deno.land/x/sqlite@v3.7.3/mod.ts).

## Limitations

There are two important limitations for this module that you need to be aware of:

1. File locking is implemented using [`dotlocker`](https://github.com/fabiospampinato/dotlocker), as such locks are always exclusionary, and locking this way is incompatible with other kinds of file locking that other builds of sqlite might use, so it's unsafe to simultaneously edit a database with this library and with another sqlite library, though it's safe for multiple instances of sqlite created by this library to manipulate the same databases, it will just not happen at the same time.
2. No kind of memory-mapping is supported, as such proper concurrent WAL mode can't really be supported, though you [should](https://www.sqlite.org/wal.html#noshm) still be able to manipulate WAL databases by setting the `PRAGMA locking_mode=EXCLUSIVE;` pragma, which will however prevent the kind of concurrency that WAL is designed for in the first place.

## License

MIT © Tilman Roeder and contributors
