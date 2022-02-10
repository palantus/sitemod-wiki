export let menu = [
  {
    title: "Wiki",
    public: true,
    items: [
      {title: "Documents", path: "/wiki-docs", permission: "wiki.edit"},
      {title: "Index", path: "/wiki", public: true, hideWhenSignedIn: true},
      {title: "Personal", path: "/wiki/index-private", permission: "wiki.edit"},
      {title: "Public", path: "/wiki/index-public", permission: "wiki.read"},
      {title: "Setup", path: "/wiki/setup", permission: "wiki.setup"},
      {title: "Shared", path: "/wiki/index-shared", permission: "wiki.read"}
    ]
  }
]