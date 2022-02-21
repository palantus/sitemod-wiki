import Role from "../../models/role.mjs"
import DataType from "../../models/datatype.mjs"

export default async () => {
  
  // init
  Role.lookupOrCreate("wiki").addPermission(["wiki.edit", "wiki.read"], true)
  Role.lookupOrCreate("admin").addPermission(["wiki.setup"], true)

  DataType.lookupOrCreate("wiki", {title: "Wiki page", permission: "wiki.read", api: "wiki", nameField: "title", uiPath: "wiki", query: "tag:wiki", acl: "r:shared;w:shared"})

  return {
  }
}