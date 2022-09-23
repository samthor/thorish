
This is a library of useful JS concepts and data structures for Node and the browser.
It it, unashamedly, a dumping ground for code needed by [@samthor](https://twitter.com/samthor)'s projects.

This library:
- is available in ESM only
- publishes its own definition files
- has _no_ side effects
- aims to have low/no interactions between code (i.e., using one helper won't bring in lots of others)
- has no dependencies

While you _can_ depend on this project directly, you should also consider bundling just the parts you need in your project's output (i.e., make it a `devDependency`).
