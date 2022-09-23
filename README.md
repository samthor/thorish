
This is a library of useful JS concepts and data structures.
It it, unashamedly, a dumping ground for code needed by [@samthor](https://twitter.com/samthor)'s projects.

This library:
- is available in ESM only
- publishes its own definition files
- has _no_ side effects
- aims to have low/no interactions between code (i.e., using one helper won't bring in lots of others)

Various parts of this library require high versions of node.
Code that interacts with `AbortSignal` needs Node 17+.
