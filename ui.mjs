export let menu = [
  {
    title: "Me",
    items: [
      {title: "Documents", path: "/wiki-docs", permission: "wiki.edit"},
      {title: "Personal Wiki", path: "/wiki/index-private", permission: "wiki.edit"}
    ]
  },
  {
    title: "Wiki",
    public: true,
    items: [
      {title: "Index", path: "/wiki", public: true, hideWhenSignedIn: true},
      {title: "Public", path: "/wiki/index-public", permission: "wiki.read"},
      {title: "Setup", path: "/wiki/setup", permission: "wiki.setup"},
      {title: "Shared", path: "/wiki/index-shared", permission: "wiki.read"}
    ]
  }
]