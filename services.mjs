import Permission from "../../models/permission.mjs"
import Role from "../../models/role.mjs"

export default async () => {
  
  Permission.lookupOrCreate("wiki.edit")
  Permission.lookupOrCreate("wiki.read")

  // init
  Role.lookupOrCreate("wiki").addPermission(["wiki.edit", "wiki.read"])

  return {
  }
}