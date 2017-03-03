const fetch = require('node-fetch');
const Future = require('fluture');
const Reader = require('fantasy-readers');

/* -------------------------------------------------------------------------- */

// :: Url ~ String  -- string representation of an HTTP URL
// :: RequestBody ~ Object -- JSON object representing HTTP request body
// :: Env ~ { url :: Url } -- Reader environment

/* -------------------------------------------------------------------------- */

// :: Show a => a -> Error ()
const logError = x => console.error(x); // eslint-disable-line no-console

// :: Show a => a -> Log ()
const log = x => console.log(x); // eslint-disable-line no-console

/* -------------------------------------------------------------------------- */

// :: Url -> Future Error Response
const getf = url => Future.fromPromise2(fetch, url, { method: 'GET' });

// :: RequestBody -> Url -> Future Error Response
const postf = body => url =>
      Future.fromPromise2(fetch, url,
        { method: 'POST',
          body: JSON.stringify(body),
        });

// :: Response -> ResponseBody
const resolveJson = res => Future.fromPromise(() => res.json(), 0);

/* -------------------------------------------------------------------------- */

// :: Array (Future a b) -> Future a (Array b)
const sequence = Future.parallel(5);

// :: Array (Future Error Response) -> Future Error (Array Response)
const sequenceGets = urls => sequence(urls.map(getf));

// :: RequestBody -> Array (Future Error Response) -> Future Error (Array Response)
const sequencePosts = body => urls => sequence(urls.map(postf(body)));

// :: ResponseBody -> Array (Future Error Response) -> Future Error (Array ResponseBody)
const sequenceRespBodies = resps => sequence(resps.map(resolveJson));

/* -------------------------------------------------------------------------- */

// The main function consists of a 'Reader' monad containing the app config
// :: Reader Env
const main = () =>
      Reader(env =>
             sequencePosts({ test: 'test' })(env.urls)
             .chain(sequenceRespBodies)
             .map(rs => rs.map(r => r.data)));

/* -------------------------------------------------------------------------- */

if (require.main === module) {
  main().run({
    urls:
    [
      'https://httpbin.org/post',
      'https://httpbin.org/post',
    ],
  }).fork(log, logError);
}
