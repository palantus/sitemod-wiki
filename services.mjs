import Role from "../../models/role.mjs"
import DataType from "../../models/datatype.mjs"
import Page from "./models/page.mjs"

export default async () => {
  
  // init
  Role.lookupOrCreate("wiki").addPermission(["wiki.edit", "wiki.read", "wiki.create"], true)
  Role.lookupOrCreate("admin").addPermission(["wiki.setup"], true)

  DataType.lookupOrCreate("wiki", {title: "Wiki page", permission: "wiki.read", api: "wiki", nameField: "title", uiPath: "wiki", acl: "r:shared;w:shared"})
          .init({typeModel: Page})

  return {
  }
}