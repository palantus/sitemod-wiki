import Role from "../../models/role.mjs"
import DataType from "../../models/datatype.mjs"
import Page from "./models/page.mjs"
import { query } from "entitystorage"

export default async () => {
  
  // init
  Role.lookupOrCreate("wiki").addPermission(["wiki.edit", "wiki.read", "wiki.create"], true)
  Role.lookupOrCreate("admin").addPermission(["wiki.setup"], true)

  DataType.lookupOrCreate("wiki", {title: "Wiki page", permission: "wiki.read", api: "wiki", nameField: "title", uiPath: "wiki", acl: "r:shared;w:shared"})
          .init({typeModel: Page})

  // Update jobs:
  for(let page of query.tag("wiki").all){
    if(!page.related.author){
      page.rel(page.related.owner, "author")
    }
  }

  return {
  }
}