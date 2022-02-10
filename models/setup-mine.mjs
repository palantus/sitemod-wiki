import Entity from "entitystorage";

export default class MySetup extends Entity{
  initNew(user){
    this.tag("mywikisetup")
    this.rel(user, "user")
  }

  static lookup(user){
    return MySetup.find(`tag:mywikisetup user.id:${user}`) || new MySetup(user)
  }

  toObj(){
    return {
      access: this.access || "shared",
      role: this.related.role?.id || null
    }
  }
}