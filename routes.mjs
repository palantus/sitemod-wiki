routes.push(...[
  {path: "/wiki",                   page: "../pages/wiki.mjs", publicAccess: true},
  {path: "/wiki-search",            page: "../pages/wiki-search.mjs"},
  {path: "/wiki/setup",             page: "../pages/wiki-setup.mjs"},
  {regexp: /\/wiki\/([a-zA-Z0-9\-]+)/,    page: "../pages/wiki.mjs", publicAccess: true}
])