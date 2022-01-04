routes.push(...[
  {path: "/wiki",                   page: "../pages/wiki.mjs"},
  {path: "/wiki-search",            page: "../pages/wiki-search.mjs"},
  {regexp: /\/wiki\/([a-zA-Z0-9\-]+)/,    page: "../pages/wiki.mjs"}
])