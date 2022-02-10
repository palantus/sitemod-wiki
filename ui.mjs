export let menu = [
  {
    title: "Wiki",
    public: true,
    items: [
      {title: "My personal", path: "/wiki/index-private", permission: "wiki.edit"},
      {title: "Shared", path: "/wiki/index-shared", permission: "wiki.read"},
      {title: "Public", path: "/wiki/index-public", permission: "wiki.read"},
      {title: "Setup", path: "/wiki/setup", permission: "wiki.setup"},
      {title: "Index", path: "/wiki", public: true, hideWhenSignedIn: true}
    ]
  }
]