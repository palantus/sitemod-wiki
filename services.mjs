import Permission from "../../models/permission.mjs"
import Role from "../../models/role.mjs"

export default async () => {
  
  // init
  Role.lookupOrCreate("wiki").addPermission(["wiki.edit", "wiki.read"], true)
  Role.lookupOrCreate("admin").addPermission(["wiki.setup"], true)

  return {
  }
}