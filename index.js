const fetch = require('node-fetch');
const Future = require('fluture');
const Reader = require('fantasy-readers');

/* -------------------------------------------------------------------------- */

// :: AccessToken ~ String  -- globally mutable access token NOTE: UNSAFE
// :: Env ~ Object          -- the Reader monad environment
// :: FetchOptions ~ Object -- node-fetch method/request options
// :: RequestBody ~ Object  -- HTTP request body
// :: ResponseBody ~ Object -- HTTP response body
// :: RefreshToken ~ String -- Authentication refresh token
// :: Showable ~ String     -- Some type that can be stringified
// :: Url ~ String          -- string representation of an HTTP URL

/* -------------------------------------------------------------------------- */

// :: AccessToken
let accessToken = '';

/* -------------------------------------------------------------------------- */

// :: Showable -> Error ()
const logError = x => console.error(x); // eslint-disable-line no-console

// :: Showable -> Log ()
const log = x => console.log(x); // eslint-disable-line no-console

/* -------------------------------------------------------------------------- */

// :: FetchOptions ->  -> Future Error Response
const fetchf = opts => url =>
      Future.fromPromise2(fetch, url, opts);

// :: Url -> Future Error Response
const getf =
      fetchf(
        { method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        });

// :: RequestBody -> Url -> Future Error Response
const postf = body =>
      fetchf(
        { method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(body),
        });

// :: Response -> Future Error ResponseBody
const resolveJson = res => Future.fromPromise(() => res.json(), 0);

/* -------------------------------------------------------------------------- */

// :: Array (Future a b) -> Future a (Array b)
const sequence = Future.parallel(Infinity);

// :: Array (Future Error Response) -> Future Error (Array Response)
const sequenceGets = urls => sequence(urls.map(getf));

// :: RequestBody -> Array (Future Error Response) -> Future Error (Array Response)
const sequencePosts = body => urls => sequence(urls.map(postf(body)));

// :: ResponseBody -> Array (Future Error Response) -> Future Error (Array ResponseBody)
const sequenceRespBodies = resps => sequence(resps.map(resolveJson));

// NOTE: This function is side effecting!
// :: Url -> RefreshToken -> Response -> Future Error Response
const unsafeCheckAuth = auth => token => (resp) => {
  if (resp.status === 403) {
    return (postf({ refresh_token: token })(auth)
            .chain(resolveJson)
            .map((body) => {
              accessToken = JSON.parse(body.data).refresh_token; // NOTE: change this to 'token'
              return body;
            }));
  } else if (resp.status >= 400) {
    return Future.reject(resp);
  }
  return Future.of(resp);
};

/* -------------------------------------------------------------------------- */

// The application logic can be thought of as a series of pure and effectful
// computations over an 'Env'ironment accessed from a 'Reader' monad
// :: Reader Env
const main = () =>
      Reader(env =>
             getf(env.teams)
             .chain(unsafeCheckAuth(env.auth)(env.token))
             .chain(() => sequenceGets(env.urls))
             .chain(sequenceRespBodies)
             .map(rs => rs.map(r => r.url)));

/* -------------------------------------------------------------------------- */

if (require.main === module) {
  main().run({
    teams: 'https://httpbin.org/status/403',
    token: 'test',
    auth: 'https://httpbin.org/post',
    urls: [
      'https://httpbin.org/get',
      'https://httpbin.org/get',
      'https://httpbin.org/get',
    ],
  }).fork(log, logError);
}
