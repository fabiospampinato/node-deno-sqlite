import {test, t} from 'fava';

const assert = arg => {
  t.true ( arg );
};

const assertAlmostEquals = ( a, b ) => {
  t.true ( Math.abs ( a - b ) < 3 );
};

const assertEquals = ( ...args ) => {
  if ( typeof args[0] === 'object' ) {
    t.deepEqual ( ...args );
  } else {
    t.is ( ...args );
  }
};

const assertInstanceOf = ( a, b ) => {
  t.true ( a instanceof b );
};

const assertMatch = ( a, b ) => {
  t.true ( b.test ( a ) );
};

const assertPass = () => {
  t.pass ();
};

const assertThrows = ( ...args ) => {
  if ( args[1] ){
    try {
      args[0]();
    } catch ( error ) {
      args[1]( error );
    }
  } else {
    t.throws ( ...args );
  }
};

export {test, assert, assertAlmostEquals, assertEquals, assertInstanceOf, assertMatch, assertPass, assertThrows};
