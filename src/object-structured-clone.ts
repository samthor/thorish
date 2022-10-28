
import { intersectObjects } from './object-utils.js';

export const structuredIshClone: <T> (o: T) => T = (typeof structuredClone === 'function') ? structuredClone : (o) => intersectObjects(o, o);
